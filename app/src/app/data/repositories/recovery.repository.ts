import type { DbAdapter } from '../../core/db/db-adapter';
import type { Soreness } from '../../core/metrics/recovery';
import type { Clock } from '../../core/util/clock';
import { ids } from '../../core/util/uuid';

export interface RecoveryRepository {
  /** Dor indicada desde `sinceDate` (YYYY-MM-DD), da mais recente para a mais antiga. */
  since(sinceDate: string): Promise<Soreness[]>;
  /** Um registo por dia e músculo: voltar a indicar no mesmo dia substitui. */
  set(date: string, muscle: string, level: number): Promise<void>;
  clear(date: string, muscle: string): Promise<void>;
}

export class RecoveryError extends Error {}

export class SqliteRecoveryRepository implements RecoveryRepository {
  constructor(
    private readonly db: DbAdapter,
    private readonly clock: Clock,
    private readonly deviceId: string,
  ) {}

  async since(sinceDate: string): Promise<Soreness[]> {
    const rows = await this.db.query<{ muscle: string; date: string; soreness: number }>(
      'SELECT muscle, date, soreness FROM muscle_recovery WHERE deleted_at IS NULL AND date >= ? ORDER BY date DESC, updated_at DESC',
      [sinceDate],
    );
    return rows.map((r) => ({ muscle: r.muscle, date: r.date, level: r.soreness }));
  }

  async set(date: string, muscle: string, level: number): Promise<void> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RecoveryError('Data inválida.');
    if (!muscle.trim()) throw new RecoveryError('Falta o músculo.');
    if (!Number.isInteger(level) || level < 1 || level > 5) throw new RecoveryError('A dor vai de 1 a 5.');
    await this.db.run(
      `INSERT INTO muscle_recovery (id, date, muscle, soreness, updated_at, deleted_at, device_id)
       VALUES (?, ?, ?, ?, ?, NULL, ?)
       ON CONFLICT(id) DO UPDATE SET soreness = excluded.soreness, deleted_at = NULL,
         updated_at = excluded.updated_at, device_id = excluded.device_id`,
      [ids.muscleRecovery(date, muscle), date, muscle, level, this.clock.nowIso(), this.deviceId],
    );
  }

  async clear(date: string, muscle: string): Promise<void> {
    const now = this.clock.nowIso();
    await this.db.run(
      'UPDATE muscle_recovery SET deleted_at = ?, updated_at = ?, device_id = ? WHERE id = ? AND deleted_at IS NULL',
      [now, now, this.deviceId, ids.muscleRecovery(date, muscle)],
    );
  }
}
