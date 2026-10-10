import type { DbAdapter } from '../../core/db/db-adapter';
import type { HrPoint, HrSummary } from '../../core/health/health.logic';

export interface SessionHealth extends HrSummary {
  caloriesKcal: number | null;
  source: string | null;
  importedAt: string;
}

export interface HealthRepository {
  /** Substitui os dados de saúde da sessão (importar de novo apaga os anteriores). */
  save(sessionId: string, points: readonly HrPoint[], summary: HrSummary, caloriesKcal: number | null, source: string, nowIso: string): Promise<void>;
  summary(sessionId: string): Promise<SessionHealth | null>;
  points(sessionId: string): Promise<HrPoint[]>;
  clear(sessionId: string): Promise<void>;
}

export class SqliteHealthRepository implements HealthRepository {
  constructor(private readonly db: DbAdapter) {}

  async save(sessionId: string, points: readonly HrPoint[], s: HrSummary, caloriesKcal: number | null, source: string, nowIso: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.run('DELETE FROM hr_sample WHERE session_id = ?', [sessionId]);
      for (const p of points) {
        await tx.run('INSERT OR REPLACE INTO hr_sample (session_id, ts, bpm) VALUES (?, ?, ?)', [sessionId, p.ts, p.bpm]);
      }
      await tx.run(
        `INSERT INTO session_health (session_id, avg_bpm, max_bpm, min_bpm, samples, calories_kcal, source, imported_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET avg_bpm = excluded.avg_bpm, max_bpm = excluded.max_bpm, min_bpm = excluded.min_bpm,
           samples = excluded.samples, calories_kcal = excluded.calories_kcal, source = excluded.source, imported_at = excluded.imported_at`,
        [sessionId, s.avg, s.max, s.min, s.samples, caloriesKcal, source, nowIso],
      );
    });
  }

  async summary(sessionId: string): Promise<SessionHealth | null> {
    const r = await this.db.query<{ avg_bpm: number | null; max_bpm: number | null; min_bpm: number | null; samples: number; calories_kcal: number | null; source: string | null; imported_at: string }>(
      'SELECT * FROM session_health WHERE session_id = ?', [sessionId],
    );
    if (!r.length) return null;
    const x = r[0];
    return { avg: x.avg_bpm, max: x.max_bpm, min: x.min_bpm, samples: x.samples, caloriesKcal: x.calories_kcal, source: x.source, importedAt: x.imported_at };
  }

  async points(sessionId: string): Promise<HrPoint[]> {
    return this.db.query<HrPoint>('SELECT ts, bpm FROM hr_sample WHERE session_id = ? ORDER BY ts', [sessionId]);
  }

  async clear(sessionId: string): Promise<void> {
    await this.db.run('DELETE FROM hr_sample WHERE session_id = ?', [sessionId]);
    await this.db.run('DELETE FROM session_health WHERE session_id = ?', [sessionId]);
  }
}
