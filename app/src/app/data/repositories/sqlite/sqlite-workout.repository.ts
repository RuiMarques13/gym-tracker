import type { DbAdapter, SqlValue } from '../../../core/db/db-adapter';
import type { Clock } from '../../../core/util/clock';
import { newId } from '../../../core/util/uuid';
import type { Block, Kind, MetricType } from '../../models/enums';
import {
  BLOCK_ORDER,
  normalizeBlock,
  PlannedExercise,
  PlannedExerciseInput,
  Workout,
  WorkoutInput,
  WorkoutSummary,
  WorkoutValidationError,
} from '../../models/workout';
import type { WorkoutRepository } from '../workout.repository';
import { fold } from './sqlite-exercise.repository';

interface ItemRow {
  id: string;
  exercise_id: string;
  exercise_name: string;
  exercise_kind: Kind;
  metric_type: MetricType;
  is_unilateral: number;
  exercise_archived_at: string | null;
  position: number;
  block: Block;
  superset_group: string | null;
  target_sets: number | null;
  target_reps: number | null;
  target_duration_seconds: number | null;
  target_weight_kg: number | null;
  target_distance_m: number | null;
  rest_seconds: number | null;
}

const int = (v: number | null | undefined, min = 0): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Math.max(min, Math.round(v));
const num = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Math.max(0, Math.round(v * 100) / 100);

/** Mantém só os alvos que fazem sentido para a forma de medir o exercício. */
export function normalizeTargets(kind: Kind, metric: MetricType, i: PlannedExerciseInput) {
  const sets = int(i.targetSets, 1);
  const rest = int(i.restSeconds);
  if (kind === 'CARDIO') {
    return { sets: sets ?? 1, reps: null, duration: int(i.targetDurationSeconds), weight: null, distance: num(i.targetDistanceM), rest };
  }
  if (metric === 'DURATION') {
    return { sets, reps: null, duration: int(i.targetDurationSeconds), weight: null, distance: null, rest };
  }
  return {
    sets,
    reps: int(i.targetReps),
    duration: null,
    weight: metric === 'WEIGHT_REPS' ? num(i.targetWeightKg) : null,
    distance: null,
    rest,
  };
}

export class SqliteWorkoutRepository implements WorkoutRepository {
  constructor(
    private readonly db: DbAdapter,
    private readonly clock: Clock,
    private readonly deviceId: string,
  ) {}

  async list(options: { includeArchived?: boolean } = {}): Promise<WorkoutSummary[]> {
    const templates = await this.db.query<{
      id: string; name: string; notes: string | null; archived_at: string | null; updated_at: string;
    }>(
      `SELECT id, name, notes, archived_at, updated_at FROM workout_template
       WHERE deleted_at IS NULL ${options.includeArchived ? '' : 'AND archived_at IS NULL'}`,
    );
    const counts = await this.db.query<{ template_id: string; block: string; n: number }>(
      `SELECT template_id, block, COUNT(*) AS n FROM planned_exercise
       WHERE deleted_at IS NULL GROUP BY template_id, block`,
    );
    return templates
      .map((t) => {
        const blockCounts: Record<Block, number> = { WARMUP: 0, MAIN: 0 };
        for (const c of counts.filter((c) => c.template_id === t.id)) blockCounts[normalizeBlock(c.block)] += c.n;
        return {
          id: t.id, name: t.name, notes: t.notes, archivedAt: t.archived_at, updatedAt: t.updated_at, blockCounts,
          exerciseCount: blockCounts.WARMUP + blockCounts.MAIN,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt', { sensitivity: 'base' }));
  }

  async get(id: string): Promise<Workout | null> {
    const rows = await this.db.query<{
      id: string; name: string; notes: string | null; archived_at: string | null; updated_at: string;
    }>('SELECT id, name, notes, archived_at, updated_at FROM workout_template WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!rows.length) return null;
    const t = rows[0];
    const items = await this.db.query<ItemRow>(
      `SELECT p.id, p.exercise_id, e.name AS exercise_name, e.kind AS exercise_kind, e.metric_type,
              e.is_unilateral, e.archived_at AS exercise_archived_at, p.position, p.block, p.superset_group,
              p.target_sets, p.target_reps, p.target_duration_seconds, p.target_weight_kg, p.target_distance_m,
              p.rest_seconds
       FROM planned_exercise p JOIN exercise e ON e.id = p.exercise_id
       WHERE p.template_id = ? AND p.deleted_at IS NULL AND e.deleted_at IS NULL
       ORDER BY p.position`,
      [id],
    );
    return {
      id: t.id,
      name: t.name,
      notes: t.notes,
      archivedAt: t.archived_at,
      updatedAt: t.updated_at,
      items: items.map(toPlanned),
    };
  }

  async save(input: WorkoutInput): Promise<Workout> {
    const name = input.name?.trim() ?? '';
    if (!name) throw new WorkoutValidationError('name', 'O nome é obrigatório.');
    const id = input.id ?? newId();
    await this.assertNameFree(name, id);

    // Exercícios referidos têm de existir (e não estar apagados).
    const exerciseIds = [...new Set(input.items.map((i) => i.exerciseId))];
    const exercises = exerciseIds.length
      ? await this.db.query<{ id: string; kind: Kind; metric_type: MetricType }>(
          `SELECT id, kind, metric_type FROM exercise WHERE deleted_at IS NULL
           AND id IN (${exerciseIds.map(() => '?').join(', ')})`,
          exerciseIds,
        )
      : [];
    const byId = new Map(exercises.map((e) => [e.id, e]));
    const missing = exerciseIds.filter((e) => !byId.has(e));
    if (missing.length) throw new WorkoutValidationError('items', 'Um dos exercícios já não existe. Remove-o do treino.');

    // Ordem: blocos pela ordem fixa, e dentro de cada bloco pela ordem do array.
    const ordered = BLOCK_ORDER.flatMap((b) => input.items.filter((i) => i.block === b));
    if (ordered.length !== input.items.length) throw new WorkoutValidationError('items', 'Bloco inválido.');
    const now = this.clock.nowIso();

    await this.db.transaction(async (tx) => {
      await tx.run(
        `INSERT INTO workout_template (id, name, notes, archived_at, updated_at, deleted_at, device_id)
         VALUES (?, ?, ?, NULL, ?, NULL, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, notes = excluded.notes,
           updated_at = excluded.updated_at, deleted_at = NULL, device_id = excluded.device_id`,
        [id, name, input.notes?.trim() || null, now, this.deviceId],
      );
      const current = await tx.query<{ id: string }>(
        'SELECT id FROM planned_exercise WHERE template_id = ? AND deleted_at IS NULL',
        [id],
      );
      const keep = new Set<string>();
      for (const [index, item] of ordered.entries()) {
        const ex = byId.get(item.exerciseId)!;
        const t = normalizeTargets(ex.kind, ex.metric_type, item);
        const itemId = item.id ?? newId();
        keep.add(itemId);
        const values: SqlValue[] = [
          itemId, id, item.exerciseId, index + 1, item.block, t.sets, t.reps, t.duration, t.weight, t.distance, t.rest,
          now, this.deviceId,
        ];
        await tx.run(
          `INSERT INTO planned_exercise (id, template_id, exercise_id, position, block, target_sets, target_reps,
             target_duration_seconds, target_weight_kg, target_distance_m, rest_seconds, updated_at, deleted_at, device_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
           ON CONFLICT(id) DO UPDATE SET template_id = excluded.template_id, exercise_id = excluded.exercise_id,
             position = excluded.position, block = excluded.block, target_sets = excluded.target_sets,
             target_reps = excluded.target_reps, target_duration_seconds = excluded.target_duration_seconds,
             target_weight_kg = excluded.target_weight_kg, target_distance_m = excluded.target_distance_m,
             rest_seconds = excluded.rest_seconds, updated_at = excluded.updated_at, deleted_at = NULL,
             device_id = excluded.device_id`,
          values,
        );
      }
      for (const row of current) {
        if (!keep.has(row.id)) {
          await tx.run('UPDATE planned_exercise SET deleted_at = ?, updated_at = ?, device_id = ? WHERE id = ?', [
            now, now, this.deviceId, row.id,
          ]);
        }
      }
    });
    return (await this.get(id))!;
  }

  async copy(id: string): Promise<Workout> {
    const source = await this.get(id);
    if (!source) throw new WorkoutValidationError('items', 'Treino não encontrado.');
    const active = await this.db.query<{ name: string }>(
      'SELECT name FROM workout_template WHERE deleted_at IS NULL AND archived_at IS NULL',
    );
    const taken = new Set(active.map((r) => fold(r.name.trim())));
    let name = `${source.name} (cópia)`;
    for (let n = 2; taken.has(fold(name)); n++) name = `${source.name} (cópia ${n})`;
    return this.save({
      name,
      notes: source.notes,
      items: source.items.map((i) => ({
        exerciseId: i.exerciseId,
        block: i.block,
        targetSets: i.targetSets,
        targetReps: i.targetReps,
        targetDurationSeconds: i.targetDurationSeconds,
        targetWeightKg: i.targetWeightKg,
        targetDistanceM: i.targetDistanceM,
        restSeconds: i.restSeconds,
      })),
    });
  }

  async archive(id: string): Promise<void> {
    const now = this.clock.nowIso();
    await this.db.run(
      'UPDATE workout_template SET archived_at = ?, updated_at = ?, device_id = ? WHERE id = ? AND deleted_at IS NULL',
      [now, now, this.deviceId, id],
    );
  }

  async restore(id: string): Promise<void> {
    const rows = await this.db.query<{ name: string }>('SELECT name FROM workout_template WHERE id = ?', [id]);
    if (!rows.length) return;
    await this.assertNameFree(rows[0].name, id);
    await this.db.run('UPDATE workout_template SET archived_at = NULL, updated_at = ?, device_id = ? WHERE id = ?', [
      this.clock.nowIso(), this.deviceId, id,
    ]);
  }

  async isUsed(id: string): Promise<boolean> {
    const rows = await this.db.query<{ n: number }>(
      'SELECT COUNT(*) AS n FROM session WHERE template_id = ? AND deleted_at IS NULL',
      [id],
    );
    return rows[0].n > 0;
  }

  async remove(id: string): Promise<void> {
    if (await this.isUsed(id)) {
      throw new WorkoutValidationError('usage', 'Este treino já tem sessões registadas. Arquiva-o em vez de o apagar.');
    }
    const now = this.clock.nowIso();
    await this.db.transaction(async (tx) => {
      for (const table of ['planned_exercise', 'scheduled_workout']) {
        await tx.run(
          `UPDATE ${table} SET deleted_at = ?, updated_at = ?, device_id = ? WHERE template_id = ? AND deleted_at IS NULL`,
          [now, now, this.deviceId, id],
        );
      }
      await tx.run('UPDATE workout_template SET deleted_at = ?, updated_at = ?, device_id = ? WHERE id = ?', [
        now, now, this.deviceId, id,
      ]);
    });
  }

  private async assertNameFree(name: string, selfId: string): Promise<void> {
    const rows = await this.db.query<{ name: string }>(
      'SELECT name FROM workout_template WHERE deleted_at IS NULL AND archived_at IS NULL AND id <> ?',
      [selfId],
    );
    const target = fold(name.trim());
    if (rows.some((r) => fold(r.name.trim()) === target)) {
      throw new WorkoutValidationError('name', `Já tens um treino chamado «${name.trim()}».`);
    }
  }
}

function toPlanned(r: ItemRow): PlannedExercise {
  return {
    id: r.id,
    exerciseId: r.exercise_id,
    exerciseName: r.exercise_name,
    exerciseKind: r.exercise_kind,
    metricType: r.metric_type,
    isUnilateral: r.is_unilateral === 1,
    exerciseArchived: r.exercise_archived_at !== null,
    position: r.position,
    block: normalizeBlock(r.block),
    supersetGroup: r.superset_group,
    targetSets: r.target_sets,
    targetReps: r.target_reps,
    targetDurationSeconds: r.target_duration_seconds,
    targetWeightKg: r.target_weight_kg,
    targetDistanceM: r.target_distance_m,
    restSeconds: r.rest_seconds,
  };
}
