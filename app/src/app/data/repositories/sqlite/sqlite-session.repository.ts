import type { DbAdapter, SqlValue } from '../../db/db-adapter';
import type { Clock } from '../../../core/util/clock';
import { newId } from '../../../core/util/uuid';
import type { Block, Kind, Mechanic, MetricType, SetType, Side } from '../../models/enums';
import { normalizeBlock } from '../../models/workout';
import {
  ExerciseHistoryEntry,
  FinishInput,
  Session,
  SessionDetailsInput,
  SessionError,
  SessionExercise,
  SessionSet,
  SessionSummary,
  SetInput,
  SideEntry,
} from '../../models/session';
import type { SessionRepository } from '../session.repository';

interface SessionRow {
  id: string;
  template_id: string | null;
  template_name: string | null;
  scheduled_id: string | null;
  started_at: string;
  ended_at: string | null;
  paused_seconds: number;
  rpe: number | null;
  notes: string | null;
}
interface ExerciseRow {
  id: string;
  exercise_id: string;
  exercise_name: string;
  kind: Kind;
  metric_type: MetricType;
  is_unilateral: number;
  block: string;
  position: number;
  superset_group: string | null;
  target_sets: number | null;
  target_reps_min: number | null;
  target_reps: number | null;
  target_duration_seconds: number | null;
  target_weight_kg: number | null;
  target_distance_m: number | null;
  rest_seconds: number | null;
  default_rest_seconds: number | null;
  mechanic: Mechanic | null;
  equipment_id: string | null;
  notes: string | null;
}
interface SetRow {
  id: string;
  session_exercise_id: string;
  position: number;
  type: SetType;
  side: Side;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  distance_m: number | null;
  calories_kcal: number | null;
  rpe: number | null;
  rom_score: number | null;
  rir: number | null;
  rest_seconds_actual: number | null;
  completed_at: string | null;
}

const clampNum = (v: number | null | undefined, min: number, max: number, round: number): number | null => {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return Math.min(max, Math.max(min, Math.round(v * round) / round));
};

/** Descanso real acima disto é pausa longa, não descanso entre séries: não se guarda. */
const MAX_REST_SECONDS = 1800;

export class SqliteSessionRepository implements SessionRepository {
  constructor(
    private readonly db: DbAdapter,
    private readonly clock: Clock,
    private readonly deviceId: string,
  ) {}

  async getActive(): Promise<Session | null> {
    const rows = await this.db.query<{ id: string }>(
      'SELECT id FROM session WHERE ended_at IS NULL AND deleted_at IS NULL ORDER BY started_at DESC LIMIT 1',
    );
    return rows.length ? this.get(rows[0].id) : null;
  }

  async get(id: string): Promise<Session | null> {
    const rows = await this.db.query<SessionRow>(
      `SELECT s.id, s.template_id, t.name AS template_name, s.scheduled_id, s.started_at, s.ended_at, s.paused_seconds, s.rpe, s.notes
       FROM session s LEFT JOIN workout_template t ON t.id = s.template_id
       WHERE s.id = ? AND s.deleted_at IS NULL`,
      [id],
    );
    if (!rows.length) return null;
    const s = rows[0];
    const exercises = await this.exercisesOf(id);
    const times = exercises.flatMap((e) => e.sets.map((x) => x.completedAt)).filter((t): t is string => t !== null);
    const lastActivityAt = times.length ? times.reduce((a, b) => (a > b ? a : b)) : null;
    return {
      id: s.id, templateId: s.template_id, templateName: s.template_name, scheduledId: s.scheduled_id, startedAt: s.started_at, endedAt: s.ended_at,
      pausedSeconds: s.paused_seconds, rpe: s.rpe, notes: s.notes, lastActivityAt, exercises,
    };
  }

  async start(options: { templateId?: string | null; scheduledId?: string | null } = {}): Promise<Session> {
    if (await this.getActive()) throw new SessionError('active', 'Já tens uma sessão em curso.');
    const templateId = options.templateId ?? null;
    const id = newId();
    const now = this.clock.nowIso();
    await this.db.transaction(async (tx) => {
      if (templateId) {
        const t = await tx.query<{ id: string }>('SELECT id FROM workout_template WHERE id = ? AND deleted_at IS NULL', [templateId]);
        if (!t.length) throw new SessionError('not-found', 'Treino não encontrado.');
      }
      await tx.run(
        `INSERT INTO session (id, template_id, scheduled_id, started_at, updated_at, deleted_at, device_id) VALUES (?, ?, ?, ?, ?, NULL, ?)`,
        [id, templateId, options.scheduledId ?? null, now, now, this.deviceId],
      );
      if (templateId) {
        const items = await tx.query<{
          exercise_id: string; position: number; block: string; superset_group: string | null; metric_type: MetricType;
          is_unilateral: number; target_sets: number | null; target_reps_min: number | null; target_reps: number | null;
          target_duration_seconds: number | null; target_weight_kg: number | null; target_distance_m: number | null;
          rest_seconds: number | null;
        }>(
          `SELECT p.exercise_id, p.position, p.block, p.superset_group, e.metric_type, e.is_unilateral, p.target_sets,
                  p.target_reps_min, p.target_reps, p.target_duration_seconds, p.target_weight_kg, p.target_distance_m, p.rest_seconds
           FROM planned_exercise p JOIN exercise e ON e.id = p.exercise_id
           WHERE p.template_id = ? AND p.deleted_at IS NULL AND e.deleted_at IS NULL ORDER BY p.position`,
          [templateId],
        );
        for (const [i, p] of items.entries()) {
          await tx.run(
            `INSERT INTO session_exercise (id, session_id, exercise_id, position, block, superset_group, metric_type,
               is_unilateral, target_sets, target_reps_min, target_reps, target_duration_seconds, target_weight_kg, target_distance_m,
               rest_seconds, updated_at, deleted_at, device_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
            [
              newId(), id, p.exercise_id, i + 1, normalizeBlock(p.block), p.superset_group, p.metric_type, p.is_unilateral,
              p.target_sets, p.target_reps_min, p.target_reps, p.target_duration_seconds, p.target_weight_kg, p.target_distance_m,
              p.rest_seconds, now, this.deviceId,
            ],
          );
        }
        // Formatos dos grupos (circuito, por tempo): copiados do treino, para a sessão guardar o seu e o resultado.
        const groups = await tx.query<{ group_key: string; kind: string; rounds: number | null; round_rest_seconds: number | null;
          work_seconds: number | null; rest_seconds: number | null; duration_seconds: number | null }>(
          `SELECT group_key, kind, rounds, round_rest_seconds, work_seconds, rest_seconds, duration_seconds
             FROM exercise_group WHERE template_id = ? AND deleted_at IS NULL`, [templateId]);
        for (const g of groups) {
          await tx.run(
            `INSERT INTO exercise_group (id, template_id, session_id, group_key, kind, rounds, round_rest_seconds, work_seconds, rest_seconds,
               duration_seconds, result_rounds, result_reps, result_seconds, updated_at, deleted_at, device_id)
             VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, NULL, ?)`,
            [newId(), id, g.group_key, g.kind, g.rounds, g.round_rest_seconds, g.work_seconds, g.rest_seconds, g.duration_seconds, now, this.deviceId]);
        }
      }
    });
    return (await this.get(id))!;
  }

  async addExercise(sessionId: string, exerciseId: string, block: Block = 'MAIN'): Promise<SessionExercise> {
    await this.assertExists(sessionId);
    const ex = await this.db.query<{ metric_type: MetricType; is_unilateral: number }>(
      'SELECT metric_type, is_unilateral FROM exercise WHERE id = ? AND deleted_at IS NULL',
      [exerciseId],
    );
    if (!ex.length) throw new SessionError('not-found', 'Exercício não encontrado.');
    const pos = await this.db.query<{ m: number | null }>(
      'SELECT MAX(position) AS m FROM session_exercise WHERE session_id = ? AND deleted_at IS NULL',
      [sessionId],
    );
    const id = newId();
    const now = this.clock.nowIso();
    await this.db.run(
      `INSERT INTO session_exercise (id, session_id, exercise_id, position, block, metric_type, is_unilateral,
         updated_at, deleted_at, device_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      [id, sessionId, exerciseId, (pos[0].m ?? 0) + 1, block, ex[0].metric_type, ex[0].is_unilateral, now, this.deviceId],
    );
    return (await this.exerciseById(id))!;
  }

  async removeExercise(sessionExerciseId: string): Promise<void> {
    await this.requireExercise(sessionExerciseId);
    const now = this.clock.nowIso();
    await this.db.transaction(async (tx) => {
      await tx.run(
        'UPDATE set_log SET deleted_at = ?, updated_at = ?, device_id = ? WHERE session_exercise_id = ? AND deleted_at IS NULL',
        [now, now, this.deviceId, sessionExerciseId],
      );
      await tx.run('UPDATE session_exercise SET deleted_at = ?, updated_at = ?, device_id = ? WHERE id = ?', [
        now, now, this.deviceId, sessionExerciseId,
      ]);
    });
  }

  async saveSet(input: SetInput): Promise<SessionExercise> {
    const se = await this.requireExercise(input.sessionExerciseId);
    const ended = await this.endedAtOf(se.session_id);
    const unilateral = se.is_unilateral === 1;
    const entries = this.validateEntries(se.kind, se.metric_type, unilateral, input.entries);
    const now = this.clock.nowIso();
    // Série acrescentada a uma sessão já terminada (correção): conta como feita no fim da sessão.
    const completedAt = ended ?? now;

    await this.db.transaction(async (tx) => {
      const existing = await tx.query<SetRow>(
        'SELECT * FROM set_log WHERE session_exercise_id = ? AND deleted_at IS NULL',
        [input.sessionExerciseId],
      );
      const isEdit = input.position !== undefined;
      const position = isEdit ? input.position! : Math.max(0, ...existing.map((r) => r.position)) + 1;
      const rowsHere = existing.filter((r) => r.position === position);
      if (isEdit && !rowsHere.length) throw new SessionError('not-found', 'Série não encontrada.');
      const type: SetType = input.type ?? rowsHere[0]?.type ?? 'WORKING';

      // Descanso real: ao registar uma série nova, fecha o descanso da anterior (da sessão toda).
      if (!isEdit && !ended) {
        const prev = await tx.query<{ id: string; position: number; session_exercise_id: string; completed_at: string }>(
          `SELECT l.id, l.position, l.session_exercise_id, l.completed_at FROM set_log l
           JOIN session_exercise x ON x.id = l.session_exercise_id
           WHERE x.session_id = ? AND l.deleted_at IS NULL AND x.deleted_at IS NULL AND l.completed_at IS NOT NULL
           ORDER BY l.completed_at DESC LIMIT 1`,
          [se.session_id],
        );
        if (prev.length) {
          const diff = Math.round((Date.parse(now) - Date.parse(prev[0].completed_at)) / 1000);
          if (diff >= 0 && diff <= MAX_REST_SECONDS) {
            await tx.run(
              `UPDATE set_log SET rest_seconds_actual = ?, updated_at = ?, device_id = ?
               WHERE session_exercise_id = ? AND position = ? AND rest_seconds_actual IS NULL AND deleted_at IS NULL`,
              [diff, now, this.deviceId, prev[0].session_exercise_id, prev[0].position],
            );
          }
        }
      }

      const keepSides = new Set<Side>();
      for (const e of entries) {
        keepSides.add(e.side);
        const row = rowsHere.find((r) => r.side === e.side);
        const values: SqlValue[] = [
          type, e.weightKg ?? null, e.reps ?? null, e.durationSeconds ?? null, e.distanceM ?? null,
          e.caloriesKcal ?? null, e.rpe ?? null, e.rir ?? null, e.romScore ?? null,
        ];
        if (row) {
          await tx.run(
            `UPDATE set_log SET type = ?, weight_kg = ?, reps = ?, duration_seconds = ?, distance_m = ?,
               calories_kcal = ?, rpe = ?, rir = ?, rom_score = ?, updated_at = ?, device_id = ? WHERE id = ?`,
            [...values, now, this.deviceId, row.id],
          );
        } else {
          await tx.run(
            `INSERT INTO set_log (id, session_exercise_id, position, side, type, weight_kg, reps, duration_seconds,
               distance_m, calories_kcal, rpe, rir, rom_score, completed_at, updated_at, deleted_at, device_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
            [newId(), input.sessionExerciseId, position, e.side, ...values, completedAt, now, this.deviceId],
          );
        }
      }
      for (const r of rowsHere) {
        if (!keepSides.has(r.side)) {
          await tx.run('UPDATE set_log SET deleted_at = ?, updated_at = ?, device_id = ? WHERE id = ?', [
            now, now, this.deviceId, r.id,
          ]);
        }
      }
    });
    return (await this.exerciseById(input.sessionExerciseId))!;
  }

  async deleteSet(sessionExerciseId: string, position: number): Promise<SessionExercise> {
    await this.requireExercise(sessionExerciseId);
    const now = this.clock.nowIso();
    await this.db.run(
      `UPDATE set_log SET deleted_at = ?, updated_at = ?, device_id = ?
       WHERE session_exercise_id = ? AND position = ? AND deleted_at IS NULL`,
      [now, now, this.deviceId, sessionExerciseId, position],
    );
    return (await this.exerciseById(sessionExerciseId))!;
  }

  async finish(id: string, input: FinishInput = {}): Promise<Session> {
    const s = await this.get(id);
    if (!s) throw new SessionError('not-found', 'Sessão não encontrada.');
    if (s.endedAt) throw new SessionError('ended', 'A sessão já terminou.');
    const now = this.clock.nowIso();
    const endedAt = input.endedAt && input.endedAt >= s.startedAt ? input.endedAt : now;
    await this.db.transaction(async (tx) => {
      await tx.run(
        'UPDATE session SET ended_at = ?, rpe = ?, notes = ?, updated_at = ?, device_id = ? WHERE id = ?',
        [endedAt, clampNum(input.rpe, 0, 10, 2), input.notes?.trim() || null, now, this.deviceId, id],
      );
      // Veio de um treino planeado: ficou feito.
      if (s.scheduledId) {
        await tx.run(
          `UPDATE scheduled_workout SET status = 'DONE', updated_at = ?, device_id = ? WHERE id = ? AND deleted_at IS NULL`,
          [now, this.deviceId, s.scheduledId],
        );
      }
    });
    return (await this.get(id))!;
  }

  async restartClock(id: string, atIso?: string): Promise<Session> {
    const s = await this.get(id);
    if (!s) throw new SessionError('not-found', 'Sessão não encontrada.');
    if (s.endedAt) throw new SessionError('ended', 'A sessão já terminou.');
    const now = this.clock.nowIso();
    await this.db.run('UPDATE session SET started_at = ?, paused_seconds = 0, updated_at = ?, device_id = ? WHERE id = ?', [atIso ?? now, now, this.deviceId, id]);
    return (await this.get(id))!;
  }

  async updateDetails(id: string, input: SessionDetailsInput): Promise<Session> {
    await this.assertExists(id);
    const now = this.clock.nowIso();
    await this.db.run('UPDATE session SET rpe = ?, notes = ?, updated_at = ?, device_id = ? WHERE id = ?', [
      clampNum(input.rpe, 0, 10, 2), input.notes?.trim() || null, now, this.deviceId, id,
    ]);
    return (await this.get(id))!;
  }

  async listFinished(options: { limit?: number; offset?: number } = {}): Promise<SessionSummary[]> {
    const rows = await this.db.query<{
      id: string; template_name: string | null; started_at: string; ended_at: string; rpe: number | null;
      notes: string | null; exercise_count: number; set_count: number; volume: number;
    }>(
      `SELECT s.id, t.name AS template_name, s.started_at, s.ended_at, s.rpe, s.notes,
         (SELECT COUNT(*) FROM session_exercise x WHERE x.session_id = s.id AND x.deleted_at IS NULL) AS exercise_count,
         (SELECT COUNT(*) FROM (
            SELECT DISTINCT l.session_exercise_id, l.position FROM set_log l
            JOIN session_exercise x ON x.id = l.session_exercise_id
            WHERE x.session_id = s.id AND x.deleted_at IS NULL AND l.deleted_at IS NULL)) AS set_count,
         (SELECT COALESCE(SUM(l.weight_kg * l.reps), 0) FROM set_log l
            JOIN session_exercise x ON x.id = l.session_exercise_id
            WHERE x.session_id = s.id AND x.deleted_at IS NULL AND l.deleted_at IS NULL AND l.type = 'WORKING') AS volume
       FROM session s LEFT JOIN workout_template t ON t.id = s.template_id
       WHERE s.deleted_at IS NULL AND s.ended_at IS NOT NULL
       ORDER BY s.started_at DESC LIMIT ? OFFSET ?`,
      [options.limit ?? 200, options.offset ?? 0],
    );
    return rows.map((r) => ({
      id: r.id, templateName: r.template_name, startedAt: r.started_at, endedAt: r.ended_at,
      exerciseCount: r.exercise_count, setCount: r.set_count, volumeKg: Math.round(r.volume * 100) / 100,
      rpe: r.rpe, notes: r.notes,
    }));
  }

  async exerciseHistory(exerciseId: string, options: { limit?: number } = {}): Promise<ExerciseHistoryEntry[]> {
    const rows = await this.db.query<{
      sx: string; session_id: string; started_at: string; template_name: string | null; kind: Kind;
      metric_type: MetricType; is_unilateral: number;
    }>(
      `SELECT x.id AS sx, s.id AS session_id, s.started_at, t.name AS template_name, e.kind, x.metric_type, x.is_unilateral
       FROM session_exercise x
       JOIN session s ON s.id = x.session_id
       JOIN exercise e ON e.id = x.exercise_id
       LEFT JOIN workout_template t ON t.id = s.template_id
       WHERE x.exercise_id = ? AND x.deleted_at IS NULL AND s.deleted_at IS NULL AND s.ended_at IS NOT NULL
         AND EXISTS (SELECT 1 FROM set_log l WHERE l.session_exercise_id = x.id AND l.deleted_at IS NULL)
       ORDER BY s.started_at DESC LIMIT ?`,
      [exerciseId, options.limit ?? 100],
    );
    const sets = await this.setsOf(rows.map((r) => r.sx));
    return rows.map((r) => ({
      sessionId: r.session_id, sessionExerciseId: r.sx, startedAt: r.started_at, templateName: r.template_name,
      kind: r.kind, metricType: r.metric_type, isUnilateral: r.is_unilateral === 1, sets: sets.get(r.sx) ?? [],
    }));
  }

  async discard(id: string): Promise<void> {
    const now = this.clock.nowIso();
    await this.db.transaction(async (tx) => {
      await tx.run(
        `UPDATE set_log SET deleted_at = ?, updated_at = ?, device_id = ?
         WHERE deleted_at IS NULL AND session_exercise_id IN (SELECT id FROM session_exercise WHERE session_id = ?)`,
        [now, now, this.deviceId, id],
      );
      await tx.run(
        'UPDATE session_exercise SET deleted_at = ?, updated_at = ?, device_id = ? WHERE session_id = ? AND deleted_at IS NULL',
        [now, now, this.deviceId, id],
      );
      await tx.run('UPDATE session SET deleted_at = ?, updated_at = ?, device_id = ? WHERE id = ?', [
        now, now, this.deviceId, id,
      ]);
    });
  }

  async previousSets(exerciseId: string, excludeSessionId?: string): Promise<SessionSet[]> {
    const last = await this.db.query<{ id: string }>(
      `SELECT x.id FROM session_exercise x JOIN session s ON s.id = x.session_id
       WHERE x.exercise_id = ? AND x.deleted_at IS NULL AND s.deleted_at IS NULL AND s.ended_at IS NOT NULL
         AND s.id <> ? AND EXISTS (SELECT 1 FROM set_log l WHERE l.session_exercise_id = x.id AND l.deleted_at IS NULL)
       ORDER BY s.started_at DESC LIMIT 1`,
      [exerciseId, excludeSessionId ?? ''],
    );
    if (!last.length) return [];
    return (await this.setsOf([last[0].id])).get(last[0].id) ?? [];
  }

  async recentSets(exerciseId: string, excludeSessionId?: string, limit = 3): Promise<SessionSet[][]> {
    const rows = await this.db.query<{ id: string }>(
      `SELECT x.id FROM session_exercise x JOIN session s ON s.id = x.session_id
       WHERE x.exercise_id = ? AND x.deleted_at IS NULL AND s.deleted_at IS NULL AND s.ended_at IS NOT NULL
         AND s.id <> ? AND EXISTS (SELECT 1 FROM set_log l WHERE l.session_exercise_id = x.id AND l.deleted_at IS NULL)
       ORDER BY s.started_at DESC, x.position DESC LIMIT ?`,
      [exerciseId, excludeSessionId ?? '', limit],
    );
    if (!rows.length) return [];
    const sets = await this.setsOf(rows.map((r) => r.id));
    return rows.map((r) => sets.get(r.id) ?? []);
  }

  // --- internos ---------------------------------------------------------------------------------

  private validateEntries(kind: Kind, metric: MetricType, unilateral: boolean, raw: SideEntry[]): SideEntry[] {
    if (!raw.length) throw new SessionError('invalid', 'Falta preencher a série.');
    const allowed: Side[] = unilateral ? ['LEFT', 'RIGHT'] : ['BOTH'];
    const seen = new Set<Side>();
    return raw.map((e) => {
      if (!allowed.includes(e.side) || seen.has(e.side)) throw new SessionError('invalid', 'Lado inválido para este exercício.');
      seen.add(e.side);
      const reps = clampNum(e.reps, 0, 10000, 1);
      const duration = clampNum(e.durationSeconds, 0, 86400, 1);
      if (metric === 'DURATION') {
        if (!duration) throw new SessionError('invalid', 'Indica a duração.');
      } else if (!reps) {
        throw new SessionError('invalid', 'Indica as repetições.');
      }
      return {
        side: e.side,
        weightKg: metric === 'WEIGHT_REPS' ? clampNum(e.weightKg, 0, 2000, 100) : null,
        reps: metric === 'DURATION' ? null : reps,
        durationSeconds: metric === 'DURATION' ? duration : null,
        distanceM: kind === 'CARDIO' ? clampNum(e.distanceM, 0, 1_000_000, 10) : null,
        caloriesKcal: kind === 'CARDIO' ? clampNum(e.caloriesKcal, 0, 100_000, 10) : null,
        rpe: clampNum(e.rpe, 0, 10, 2),
        rir: kind === 'STRENGTH' ? clampNum(e.rir, 0, 4, 1) : null,
        romScore: kind === 'MOBILITY' ? clampNum(e.romScore, 1, 5, 1) : null,
      };
    });
  }

  private async assertExists(sessionId: string): Promise<void> {
    await this.endedAtOf(sessionId);
  }

  /** ended_at da sessão (null se em curso). Lança se a sessão não existe. */
  private async endedAtOf(sessionId: string): Promise<string | null> {
    const rows = await this.db.query<{ ended_at: string | null }>(
      'SELECT ended_at FROM session WHERE id = ? AND deleted_at IS NULL',
      [sessionId],
    );
    if (!rows.length) throw new SessionError('not-found', 'Sessão não encontrada.');
    return rows[0].ended_at;
  }

  private async requireExercise(id: string): Promise<{ id: string; session_id: string; metric_type: MetricType; is_unilateral: number; kind: Kind }> {
    const rows = await this.db.query<{ id: string; session_id: string; metric_type: MetricType; is_unilateral: number; kind: Kind }>(
      `SELECT x.id, x.session_id, x.metric_type, x.is_unilateral, e.kind FROM session_exercise x
       JOIN exercise e ON e.id = x.exercise_id WHERE x.id = ? AND x.deleted_at IS NULL`,
      [id],
    );
    if (!rows.length) throw new SessionError('not-found', 'Exercício da sessão não encontrado.');
    return rows[0];
  }

  private async exercisesOf(sessionId: string): Promise<SessionExercise[]> {
    const rows = await this.db.query<ExerciseRow>(EXERCISE_SQL + ' WHERE x.session_id = ? AND x.deleted_at IS NULL ORDER BY x.position', [sessionId]);
    const sets = await this.setsOf(rows.map((r) => r.id));
    return rows.map((r) => toExercise(r, sets.get(r.id) ?? []));
  }

  private async exerciseById(id: string): Promise<SessionExercise | null> {
    const rows = await this.db.query<ExerciseRow>(EXERCISE_SQL + ' WHERE x.id = ? AND x.deleted_at IS NULL', [id]);
    if (!rows.length) return null;
    return toExercise(rows[0], (await this.setsOf([id])).get(id) ?? []);
  }

  private async setsOf(exerciseIds: string[]): Promise<Map<string, SessionSet[]>> {
    const out = new Map<string, SessionSet[]>();
    if (!exerciseIds.length) return out;
    const rows = await this.db.query<SetRow>(
      `SELECT * FROM set_log WHERE deleted_at IS NULL AND session_exercise_id IN (${exerciseIds.map(() => '?').join(', ')})
       ORDER BY position, side`,
      exerciseIds,
    );
    for (const r of rows) {
      const list = out.get(r.session_exercise_id) ?? [];
      list.push({
        id: r.id, position: r.position, type: r.type, side: r.side, weightKg: r.weight_kg, reps: r.reps,
        durationSeconds: r.duration_seconds, distanceM: r.distance_m, caloriesKcal: r.calories_kcal, rpe: r.rpe,
        rir: r.rir, romScore: r.rom_score, restSecondsActual: r.rest_seconds_actual, completedAt: r.completed_at,
      });
      out.set(r.session_exercise_id, list);
    }
    return out;
  }
}

const EXERCISE_SQL = `
  SELECT x.id, x.exercise_id, e.name AS exercise_name, e.kind, x.metric_type, x.is_unilateral, x.block, x.position,
         x.superset_group, x.target_sets, x.target_reps_min, x.target_reps, x.target_duration_seconds, x.target_weight_kg,
         x.target_distance_m, x.rest_seconds, e.default_rest_seconds, x.notes, e.mechanic, e.equipment_id
  FROM session_exercise x JOIN exercise e ON e.id = x.exercise_id`;

function toExercise(r: ExerciseRow, sets: SessionSet[]): SessionExercise {
  return {
    id: r.id, exerciseId: r.exercise_id, exerciseName: r.exercise_name, kind: r.kind, metricType: r.metric_type,
    isUnilateral: r.is_unilateral === 1, block: normalizeBlock(r.block), position: r.position,
    supersetGroup: r.superset_group, targetSets: r.target_sets, targetRepsMin: r.target_reps_min, targetReps: r.target_reps,
    targetDurationSeconds: r.target_duration_seconds, targetWeightKg: r.target_weight_kg,
    targetDistanceM: r.target_distance_m, restSeconds: r.rest_seconds ?? r.default_rest_seconds, notes: r.notes,
    mechanic: r.mechanic ?? null, equipmentId: r.equipment_id ?? null, sets,
  };
}
