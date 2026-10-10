import type { DbAdapter } from '../../core/db/db-adapter';
import type { Clock } from '../../core/util/clock';
import { newId } from '../../core/util/uuid';
import type { ScheduledStatus } from '../models/enums';
import { ScheduleError, ScheduledWorkout } from '../models/scheduled';

export interface ScheduledRepository {
  /** Treinos planeados entre duas datas (inclusivas), por data. */
  list(from: string, to: string): Promise<ScheduledWorkout[]>;
  /** O próximo ainda por fazer, de hoje em diante. */
  next(today: string): Promise<ScheduledWorkout | null>;
  schedule(date: string, templateId: string): Promise<ScheduledWorkout>;
  setStatus(id: string, status: ScheduledStatus): Promise<void>;
  move(id: string, date: string): Promise<void>;
  remove(id: string): Promise<void>;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

interface Row {
  id: string;
  date: string;
  template_id: string;
  template_name: string;
  status: ScheduledStatus;
}
const SELECT = `SELECT w.id, w.date, w.template_id, t.name AS template_name, w.status
  FROM scheduled_workout w JOIN workout_template t ON t.id = w.template_id`;
const map = (r: Row): ScheduledWorkout => ({
  id: r.id, date: r.date, templateId: r.template_id, templateName: r.template_name, status: r.status,
});

export class SqliteScheduledRepository implements ScheduledRepository {
  constructor(
    private readonly db: DbAdapter,
    private readonly clock: Clock,
    private readonly deviceId: string,
  ) {}

  async list(from: string, to: string): Promise<ScheduledWorkout[]> {
    const rows = await this.db.query<Row>(
      `${SELECT} WHERE w.deleted_at IS NULL AND t.deleted_at IS NULL AND w.date BETWEEN ? AND ? ORDER BY w.date, t.name`,
      [from, to],
    );
    return rows.map(map);
  }

  async next(today: string): Promise<ScheduledWorkout | null> {
    const rows = await this.db.query<Row>(
      `${SELECT} WHERE w.deleted_at IS NULL AND t.deleted_at IS NULL AND t.archived_at IS NULL
         AND w.status = 'PLANNED' AND w.date >= ? ORDER BY w.date, t.name LIMIT 1`,
      [today],
    );
    return rows.length ? map(rows[0]) : null;
  }

  async schedule(date: string, templateId: string): Promise<ScheduledWorkout> {
    if (!DATE.test(date)) throw new ScheduleError('Data inválida.');
    const t = await this.db.query<{ id: string }>(
      'SELECT id FROM workout_template WHERE id = ? AND deleted_at IS NULL AND archived_at IS NULL',
      [templateId],
    );
    if (!t.length) throw new ScheduleError('Esse treino já não existe ou está arquivado.');
    const id = newId();
    const now = this.clock.nowIso();
    await this.db.run(
      `INSERT INTO scheduled_workout (id, date, template_id, status, updated_at, deleted_at, device_id)
       VALUES (?, ?, ?, 'PLANNED', ?, NULL, ?)`,
      [id, date, templateId, now, this.deviceId],
    );
    return map((await this.db.query<Row>(`${SELECT} WHERE w.id = ?`, [id]))[0]);
  }

  async setStatus(id: string, status: ScheduledStatus): Promise<void> {
    await this.db.run('UPDATE scheduled_workout SET status = ?, updated_at = ?, device_id = ? WHERE id = ? AND deleted_at IS NULL', [
      status, this.clock.nowIso(), this.deviceId, id,
    ]);
  }

  async move(id: string, date: string): Promise<void> {
    if (!DATE.test(date)) throw new ScheduleError('Data inválida.');
    await this.db.run('UPDATE scheduled_workout SET date = ?, updated_at = ?, device_id = ? WHERE id = ? AND deleted_at IS NULL', [
      date, this.clock.nowIso(), this.deviceId, id,
    ]);
  }

  async remove(id: string): Promise<void> {
    const now = this.clock.nowIso();
    await this.db.run('UPDATE scheduled_workout SET deleted_at = ?, updated_at = ?, device_id = ? WHERE id = ?', [
      now, now, this.deviceId, id,
    ]);
  }
}
