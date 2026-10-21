import type { DbAdapter, SqlValue } from '../../db/db-adapter';
import type { Clock } from '../../../core/util/clock';
import { newId } from '../../../core/util/uuid';
import { normalizeConfig, type GroupConfig, type GroupKind } from '../../../core/session/group-format';
import type { ExerciseGroup, GroupResult } from '../../models/group';
import type { GroupRepository } from '../group.repository';

interface Row {
  id: string; template_id: string | null; session_id: string | null; group_key: string; kind: string;
  rounds: number | null; round_rest_seconds: number | null; work_seconds: number | null; rest_seconds: number | null;
  duration_seconds: number | null; result_rounds: number | null; result_reps: number | null; result_seconds: number | null;
}

const COLS = `id, template_id, session_id, group_key, kind, rounds, round_rest_seconds, work_seconds, rest_seconds, duration_seconds,
  result_rounds, result_reps, result_seconds`;

const toGroup = (r: Row): ExerciseGroup => ({
  ...normalizeConfig({
    kind: r.kind as GroupKind, rounds: r.rounds, roundRestSeconds: r.round_rest_seconds, workSeconds: r.work_seconds,
    restSeconds: r.rest_seconds, durationSeconds: r.duration_seconds,
  }),
  id: r.id, templateId: r.template_id, sessionId: r.session_id, groupKey: r.group_key,
  resultRounds: r.result_rounds, resultReps: r.result_reps, resultSeconds: r.result_seconds,
});

const configValues = (c: GroupConfig): SqlValue[] => {
  const n = normalizeConfig(c);
  return [n.kind, n.rounds, n.roundRestSeconds, n.workSeconds, n.restSeconds, n.durationSeconds];
};

export class SqliteGroupRepository implements GroupRepository {
  constructor(
    private readonly db: DbAdapter,
    private readonly clock: Clock,
    private readonly deviceId: string,
  ) {}

  async forTemplate(templateId: string): Promise<ExerciseGroup[]> {
    const rows = await this.db.query<Row>(`SELECT ${COLS} FROM exercise_group WHERE template_id = ? AND deleted_at IS NULL ORDER BY group_key`, [templateId]);
    return rows.map(toGroup);
  }

  async forSession(sessionId: string): Promise<ExerciseGroup[]> {
    const rows = await this.db.query<Row>(`SELECT ${COLS} FROM exercise_group WHERE session_id = ? AND deleted_at IS NULL ORDER BY group_key`, [sessionId]);
    return rows.map(toGroup);
  }

  async saveForTemplate(templateId: string, groups: { groupKey: string; config: GroupConfig }[]): Promise<void> {
    const now = this.clock.nowIso();
    await this.db.transaction(async (tx) => {
      const existing = await tx.query<{ id: string; group_key: string }>(
        'SELECT id, group_key FROM exercise_group WHERE template_id = ? AND deleted_at IS NULL', [templateId]);
      const byKey = new Map(existing.map((r) => [r.group_key, r.id]));
      const keep = new Set<string>();
      for (const g of groups) {
        // Superset sem nada a guardar: dispensa a linha (é o formato por defeito).
        if (g.config.kind === 'SUPERSET') continue;
        const id = byKey.get(g.groupKey);
        if (id) {
          keep.add(id);
          await tx.run(
            `UPDATE exercise_group SET kind = ?, rounds = ?, round_rest_seconds = ?, work_seconds = ?, rest_seconds = ?, duration_seconds = ?,
               updated_at = ?, device_id = ? WHERE id = ?`,
            [...configValues(g.config), now, this.deviceId, id]);
        } else {
          await tx.run(
            `INSERT INTO exercise_group (id, template_id, session_id, group_key, kind, rounds, round_rest_seconds, work_seconds, rest_seconds,
               duration_seconds, result_rounds, result_reps, result_seconds, updated_at, deleted_at, device_id)
             VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, NULL, ?)`,
            [newId(), templateId, g.groupKey, ...configValues(g.config), now, this.deviceId]);
        }
      }
      for (const r of existing) {
        if (!keep.has(r.id)) {
          await tx.run('UPDATE exercise_group SET deleted_at = ?, updated_at = ?, device_id = ? WHERE id = ?', [now, now, this.deviceId, r.id]);
        }
      }
    });
  }

  async saveForSession(sessionId: string, groupKey: string, config: GroupConfig): Promise<ExerciseGroup> {
    const now = this.clock.nowIso();
    const found = await this.db.query<{ id: string }>(
      'SELECT id FROM exercise_group WHERE session_id = ? AND group_key = ? AND deleted_at IS NULL', [sessionId, groupKey]);
    if (found.length) {
      await this.db.run(
        `UPDATE exercise_group SET kind = ?, rounds = ?, round_rest_seconds = ?, work_seconds = ?, rest_seconds = ?, duration_seconds = ?,
           updated_at = ?, device_id = ? WHERE id = ?`,
        [...configValues(config), now, this.deviceId, found[0].id]);
    } else {
      await this.db.run(
        `INSERT INTO exercise_group (id, template_id, session_id, group_key, kind, rounds, round_rest_seconds, work_seconds, rest_seconds,
           duration_seconds, result_rounds, result_reps, result_seconds, updated_at, deleted_at, device_id)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, NULL, ?)`,
        [newId(), sessionId, groupKey, ...configValues(config), now, this.deviceId]);
    }
    return (await this.forSession(sessionId)).find((g) => g.groupKey === groupKey)!;
  }

  async saveResult(sessionId: string, groupKey: string, result: GroupResult): Promise<void> {
    const now = this.clock.nowIso();
    await this.db.run(
      `UPDATE exercise_group SET result_rounds = ?, result_reps = ?, result_seconds = ?, updated_at = ?, device_id = ?
       WHERE session_id = ? AND group_key = ? AND deleted_at IS NULL`,
      [result.rounds, result.reps, result.seconds, now, this.deviceId, sessionId, groupKey]);
  }

  async lastResult(templateId: string, groupKey: string, beforeSessionId: string): Promise<GroupResult | null> {
    const rows = await this.db.query<{ result_rounds: number | null; result_reps: number | null; result_seconds: number | null }>(
      `SELECT g.result_rounds, g.result_reps, g.result_seconds
         FROM exercise_group g JOIN session s ON s.id = g.session_id AND s.deleted_at IS NULL AND s.ended_at IS NOT NULL
        WHERE s.template_id = ? AND g.group_key = ? AND g.deleted_at IS NULL AND g.session_id <> ?
          AND (g.result_rounds IS NOT NULL OR g.result_reps IS NOT NULL)
        ORDER BY s.started_at DESC LIMIT 1`,
      [templateId, groupKey, beforeSessionId]);
    return rows.length ? { rounds: rows[0].result_rounds, reps: rows[0].result_reps, seconds: rows[0].result_seconds } : null;
  }
}
