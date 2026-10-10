import type { DbAdapter } from '../../core/db/db-adapter';
import { addDays } from '../../core/util/week';
import type { Region } from '../models/enums';

export interface MuscleSets {
  muscleId: string;
  muscle: string;
  region: Region | null;
  /** Séries de trabalho: 1 por músculo principal, `secondaryWeight` por secundário. */
  series: number;
}

export interface MobilityWeek {
  minutes: number;
  /** Sessões com pelo menos uma série de mobilidade. */
  sessions: number;
  activeDays: number;
}

export interface MetricsRepository {
  /** Semana de segunda a domingo (hora local); weekStart = «YYYY-MM-DD» da segunda. Mais séries primeiro. */
  weeklySetsByMuscle(weekStart: string, secondaryWeight: number): Promise<MuscleSets[]>;
  mobilityWeek(weekStart: string): Promise<MobilityWeek>;
  /** Dias seguidos com mobilidade até hoje (se hoje ainda não fizeste, conta até ontem). */
  mobilityStreak(today: string): Promise<number>;
}

const WEEK_OF = `date(s.started_at, 'localtime', 'weekday 0', '-6 days')`;

export class SqliteMetricsRepository implements MetricsRepository {
  constructor(private readonly db: DbAdapter) {}

  async weeklySetsByMuscle(weekStart: string, secondaryWeight: number): Promise<MuscleSets[]> {
    const rows = await this.db.query<{ muscle_group_id: string; name: string; region: Region | null; series: number }>(
      `WITH series AS (
         SELECT DISTINCT sl.session_exercise_id, sl.position
         FROM set_log sl
         WHERE sl.type = 'WORKING' AND sl.completed_at IS NOT NULL AND sl.deleted_at IS NULL
       )
       SELECT em.muscle_group_id, mg.name, mg.region,
              SUM(CASE WHEN em.is_primary = 1 THEN 1.0 ELSE ? END) AS series
       FROM series x
       JOIN session_exercise se ON se.id = x.session_exercise_id AND se.deleted_at IS NULL
       JOIN session s ON s.id = se.session_id AND s.deleted_at IS NULL
       JOIN exercise e ON e.id = se.exercise_id AND e.kind = 'STRENGTH'
       JOIN exercise_muscle em ON em.exercise_id = e.id AND em.deleted_at IS NULL
       JOIN muscle_group mg ON mg.id = em.muscle_group_id AND mg.deleted_at IS NULL
       WHERE ${WEEK_OF} = ?
       GROUP BY em.muscle_group_id
       ORDER BY series DESC, mg.name`,
      [secondaryWeight, weekStart],
    );
    return rows.map((r) => ({ muscleId: r.muscle_group_id, muscle: r.name, region: r.region, series: r.series }));
  }

  async mobilityWeek(weekStart: string): Promise<MobilityWeek> {
    const rows = await this.db.query<{ seconds: number | null; sessions: number; days: number }>(
      `SELECT SUM(sl.duration_seconds) AS seconds,
              COUNT(DISTINCT s.id) AS sessions,
              COUNT(DISTINCT date(s.started_at, 'localtime')) AS days
       FROM set_log sl
       JOIN session_exercise se ON se.id = sl.session_exercise_id AND se.deleted_at IS NULL
       JOIN session s ON s.id = se.session_id AND s.deleted_at IS NULL
       JOIN exercise e ON e.id = se.exercise_id AND e.kind = 'MOBILITY'
       WHERE sl.deleted_at IS NULL AND sl.completed_at IS NOT NULL AND ${WEEK_OF} = ?`,
      [weekStart],
    );
    const r = rows[0];
    return { minutes: Math.round(((r.seconds ?? 0) / 60) * 10) / 10, sessions: r.sessions, activeDays: r.days };
  }

  async mobilityStreak(today: string): Promise<number> {
    const rows = await this.db.query<{ d: string }>(
      `SELECT DISTINCT date(s.started_at, 'localtime') AS d
       FROM set_log sl
       JOIN session_exercise se ON se.id = sl.session_exercise_id AND se.deleted_at IS NULL
       JOIN session s ON s.id = se.session_id AND s.deleted_at IS NULL
       JOIN exercise e ON e.id = se.exercise_id AND e.kind = 'MOBILITY'
       WHERE sl.deleted_at IS NULL AND sl.completed_at IS NOT NULL
       ORDER BY d DESC`,
    );
    const days = new Set(rows.map((r) => r.d));
    let cursor = days.has(today) ? today : addDays(today, -1);
    let n = 0;
    while (days.has(cursor)) {
      n++;
      cursor = addDays(cursor, -1);
    }
    return n;
  }
}
