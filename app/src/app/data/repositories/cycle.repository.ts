import type { DbAdapter } from '../../core/db/db-adapter';
import type { Goal } from '../../core/metrics/volume';
import type { Cycle, CyclePlan, TemplateId } from '../../core/progression/cycles';
import type { Clock } from '../../core/util/clock';
import { newId } from '../../core/util/uuid';

export interface CycleInput {
  id?: string;
  name: string;
  goal: Goal;
  template: TemplateId;
  startDate: string;
  plan: CyclePlan;
  notes?: string | null;
}

export interface CycleRepository {
  list(options?: { includeArchived?: boolean }): Promise<Cycle[]>;
  get(id: string): Promise<Cycle | null>;
  save(input: CycleInput): Promise<Cycle>;
  archive(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export class CycleError extends Error {}

interface Row {
  id: string; name: string; goal: Goal; template: TemplateId; start_date: string; plan: string; notes: string | null;
  archived_at: string | null; updated_at: string;
}

export class SqliteCycleRepository implements CycleRepository {
  constructor(private readonly db: DbAdapter, private readonly clock: Clock, private readonly deviceId: string) {}

  async list(options: { includeArchived?: boolean } = {}): Promise<Cycle[]> {
    const rows = await this.db.query<Row>(
      `SELECT * FROM training_cycle WHERE deleted_at IS NULL ${options.includeArchived ? '' : 'AND archived_at IS NULL'} ORDER BY start_date DESC`,
    );
    return rows.map(toCycle).filter((c): c is Cycle => !!c);
  }

  async get(id: string): Promise<Cycle | null> {
    const rows = await this.db.query<Row>('SELECT * FROM training_cycle WHERE id = ? AND deleted_at IS NULL', [id]);
    return rows.length ? toCycle(rows[0]) : null;
  }

  async save(input: CycleInput): Promise<Cycle> {
    const name = input.name.trim();
    if (!name) throw new CycleError('Falta o nome.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) throw new CycleError('Data de início inválida.');
    if (!input.plan.blocks.length || input.plan.blocks.some((b) => !b.weeks.length)) throw new CycleError('Cada mesociclo precisa de pelo menos uma semana.');
    const id = input.id ?? newId();
    const now = this.clock.nowIso();
    await this.db.run(
      `INSERT INTO training_cycle (id, name, goal, template, start_date, plan, notes, archived_at, updated_at, deleted_at, device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, goal = excluded.goal, template = excluded.template,
         start_date = excluded.start_date, plan = excluded.plan, notes = excluded.notes, updated_at = excluded.updated_at,
         deleted_at = NULL, device_id = excluded.device_id`,
      [id, name, input.goal, input.template, input.startDate, JSON.stringify(input.plan), input.notes ?? null, now, this.deviceId],
    );
    return (await this.get(id))!;
  }

  async archive(id: string): Promise<void> {
    const now = this.clock.nowIso();
    await this.db.run('UPDATE training_cycle SET archived_at = ?, updated_at = ?, device_id = ? WHERE id = ?', [now, now, this.deviceId, id]);
  }

  async remove(id: string): Promise<void> {
    const now = this.clock.nowIso();
    await this.db.run('UPDATE training_cycle SET deleted_at = ?, updated_at = ?, device_id = ? WHERE id = ?', [now, now, this.deviceId, id]);
  }
}

function toCycle(r: Row): Cycle | null {
  try {
    const plan = JSON.parse(r.plan) as CyclePlan;
    if (!Array.isArray(plan?.blocks)) return null;
    return {
      id: r.id, name: r.name, goal: r.goal, template: r.template, startDate: r.start_date, plan, notes: r.notes,
      archivedAt: r.archived_at, updatedAt: r.updated_at,
    };
  } catch {
    return null;
  }
}
