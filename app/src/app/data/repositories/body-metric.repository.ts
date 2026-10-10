import type { DbAdapter } from '../../core/db/db-adapter';
import type { Clock } from '../../core/util/clock';
import { newId } from '../../core/util/uuid';
import { BODY_TYPES, BodyMetric, BodyMetricError } from '../models/body';

export interface BodyMetricRepository {
  /** Medições de um tipo, da mais recente para a mais antiga. */
  list(type: string, limit?: number): Promise<BodyMetric[]>;
  /** A medição mais recente de cada tipo. */
  latest(): Promise<BodyMetric[]>;
  add(input: { date: string; type: string; value: number }): Promise<BodyMetric>;
  remove(id: string): Promise<void>;
}

interface Row { id: string; date: string; type: string; value: number }
const map = (r: Row): BodyMetric => ({ id: r.id, date: r.date, type: r.type, value: r.value });

export class SqliteBodyMetricRepository implements BodyMetricRepository {
  constructor(
    private readonly db: DbAdapter,
    private readonly clock: Clock,
    private readonly deviceId: string,
  ) {}

  async list(type: string, limit = 200): Promise<BodyMetric[]> {
    const rows = await this.db.query<Row>(
      'SELECT id, date, type, value FROM body_metric WHERE type = ? AND deleted_at IS NULL ORDER BY date DESC, updated_at DESC LIMIT ?',
      [type, limit],
    );
    return rows.map(map);
  }

  async latest(): Promise<BodyMetric[]> {
    const rows = await this.db.query<Row>(
      `SELECT b.id, b.date, b.type, b.value FROM body_metric b
       WHERE b.deleted_at IS NULL AND b.id = (
         SELECT b2.id FROM body_metric b2 WHERE b2.type = b.type AND b2.deleted_at IS NULL
         ORDER BY b2.date DESC, b2.updated_at DESC LIMIT 1)
       ORDER BY b.type`,
    );
    return rows.map(map);
  }

  async add(input: { date: string; type: string; value: number }): Promise<BodyMetric> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new BodyMetricError('Data inválida.');
    if (!input.type.trim()) throw new BodyMetricError('Falta o tipo de medição.');
    if (!Number.isFinite(input.value)) throw new BodyMetricError('Indica um valor.');
    const known = BODY_TYPES.find((t) => t.type === input.type);
    if (known && (input.value < known.min || input.value > known.max)) {
      throw new BodyMetricError(`${known.label}: o valor tem de estar entre ${known.min} e ${known.max} ${known.unit}.`);
    }
    const id = newId();
    const value = Math.round(input.value * 100) / 100;
    await this.db.run(
      'INSERT INTO body_metric (id, date, type, value, updated_at, deleted_at, device_id) VALUES (?, ?, ?, ?, ?, NULL, ?)',
      [id, input.date, input.type, value, this.clock.nowIso(), this.deviceId],
    );
    return { id, date: input.date, type: input.type, value };
  }

  async remove(id: string): Promise<void> {
    const now = this.clock.nowIso();
    await this.db.run('UPDATE body_metric SET deleted_at = ?, updated_at = ?, device_id = ? WHERE id = ?', [now, now, this.deviceId, id]);
  }
}
