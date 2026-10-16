import type { DbAdapter } from '../db/db-adapter';
import type { CaloriesBasis, HrPoint, HrSummary } from '../../core/health/health.logic';

/** Dados do relógio de uma sessão, além das amostras de FC. Tudo opcional: depende do que o relógio escreveu. */
export interface HealthExtras {
  /** Gasto total (com o repouso), kcal. */
  caloriesTotalKcal: number | null;
  /** Repouso durante o treino, kcal. */
  caloriesBasalKcal: number | null;
  caloriesBasis: CaloriesBasis | null;
  steps: number | null;
  distanceM: number | null;
  /** FC nos últimos 30 s do treino e queda ao fim de 1 min. */
  hrEndBpm: number | null;
  hrRecoveryBpm: number | null;
  /** Tipo de exercício registado no relógio (ex.: runningTreadmill) e duração dele. */
  exerciseType: string | null;
  exerciseSeconds: number | null;
  vo2max: number | null;
}

export const NO_EXTRAS: HealthExtras = {
  caloriesTotalKcal: null, caloriesBasalKcal: null, caloriesBasis: null, steps: null, distanceM: null,
  hrEndBpm: null, hrRecoveryBpm: null, exerciseType: null, exerciseSeconds: null, vo2max: null,
};

export interface SessionHealth extends HrSummary, HealthExtras {
  /** Calorias ativas (acima do repouso), kcal. */
  caloriesKcal: number | null;
  source: string | null;
  importedAt: string;
}

export interface HealthRepository {
  /** Substitui os dados de saúde da sessão (importar de novo apaga os anteriores). */
  save(sessionId: string, points: readonly HrPoint[], summary: HrSummary, caloriesKcal: number | null, extras: HealthExtras, source: string, nowIso: string): Promise<void>;
  summary(sessionId: string): Promise<SessionHealth | null>;
  points(sessionId: string): Promise<HrPoint[]>;
  clear(sessionId: string): Promise<void>;
  /** Resumos de todas as sessões com dados de saúde, por id da sessão. */
  all(): Promise<Map<string, SessionHealth>>;
}

interface Row {
  session_id: string;
  avg_bpm: number | null;
  max_bpm: number | null;
  min_bpm: number | null;
  samples: number;
  calories_kcal: number | null;
  calories_total_kcal: number | null;
  calories_basal_kcal: number | null;
  calories_basis: string | null;
  steps: number | null;
  distance_m: number | null;
  hr_end_bpm: number | null;
  hr_recovery_bpm: number | null;
  exercise_type: string | null;
  exercise_seconds: number | null;
  vo2max: number | null;
  source: string | null;
  imported_at: string;
}

function fromRow(x: Row): SessionHealth {
  return {
    avg: x.avg_bpm, max: x.max_bpm, min: x.min_bpm, samples: x.samples,
    caloriesKcal: x.calories_kcal, caloriesTotalKcal: x.calories_total_kcal, caloriesBasalKcal: x.calories_basal_kcal,
    caloriesBasis: x.calories_basis as CaloriesBasis | null,
    steps: x.steps, distanceM: x.distance_m, hrEndBpm: x.hr_end_bpm, hrRecoveryBpm: x.hr_recovery_bpm,
    exerciseType: x.exercise_type, exerciseSeconds: x.exercise_seconds, vo2max: x.vo2max,
    source: x.source, importedAt: x.imported_at,
  };
}

export class SqliteHealthRepository implements HealthRepository {
  constructor(private readonly db: DbAdapter) {}

  async save(sessionId: string, points: readonly HrPoint[], s: HrSummary, caloriesKcal: number | null, e: HealthExtras, source: string, nowIso: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.run('DELETE FROM hr_sample WHERE session_id = ?', [sessionId]);
      for (const p of points) {
        await tx.run('INSERT OR REPLACE INTO hr_sample (session_id, ts, bpm) VALUES (?, ?, ?)', [sessionId, p.ts, p.bpm]);
      }
      await tx.run(
        `INSERT OR REPLACE INTO session_health
           (session_id, avg_bpm, max_bpm, min_bpm, samples, calories_kcal, calories_total_kcal, calories_basal_kcal, calories_basis,
            steps, distance_m, hr_end_bpm, hr_recovery_bpm, exercise_type, exercise_seconds, vo2max, source, imported_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [sessionId, s.avg, s.max, s.min, s.samples, caloriesKcal, e.caloriesTotalKcal, e.caloriesBasalKcal, e.caloriesBasis,
          e.steps, e.distanceM, e.hrEndBpm, e.hrRecoveryBpm, e.exerciseType, e.exerciseSeconds, e.vo2max, source, nowIso],
      );
    });
  }

  async summary(sessionId: string): Promise<SessionHealth | null> {
    const r = await this.db.query<Row>('SELECT * FROM session_health WHERE session_id = ?', [sessionId]);
    return r.length ? fromRow(r[0]) : null;
  }

  async points(sessionId: string): Promise<HrPoint[]> {
    return this.db.query<HrPoint>('SELECT ts, bpm FROM hr_sample WHERE session_id = ? ORDER BY ts', [sessionId]);
  }

  async clear(sessionId: string): Promise<void> {
    await this.db.run('DELETE FROM hr_sample WHERE session_id = ?', [sessionId]);
    await this.db.run('DELETE FROM session_health WHERE session_id = ?', [sessionId]);
  }

  async all(): Promise<Map<string, SessionHealth>> {
    const rows = await this.db.query<Row>('SELECT * FROM session_health');
    return new Map(rows.map((x) => [x.session_id, fromRow(x)]));
  }
}
