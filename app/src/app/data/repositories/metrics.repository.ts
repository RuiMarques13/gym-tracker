import type { DbAdapter } from '../db/db-adapter';
import { addDays } from '../../core/util/week';
import { SPEC_MUSCLE_OF_KEY } from '../../core/metrics/muscles';
import type { MetricExercise, MetricSet } from '../../core/metrics/volume';
import { ids } from '../../core/util/uuid';
import { CATEGORIES, resolveCategory, type Category, type Kind, type Region } from '../models/enums';

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

/** Totais de uma categoria de exercício (força, potência, cardio, HIIT, mobilidade, alongamento, equilíbrio, yoga/pilates). */
export interface CategoryTotals {
  category: Category;
  /** Sessões com pelo menos uma série desta categoria. */
  sessions: number;
  /** Exercícios distintos. */
  exercises: number;
  /** Séries de trabalho (LEFT/RIGHT contam uma vez). */
  sets: number;
  /** Repetições de trabalho. */
  reps: number;
  /** Carga × repetições das séries de trabalho (kg). */
  volumeKg: number;
  minutes: number;
  distanceKm: number;
}

/** O que se pode somar por categoria e por semana (todas aditivas entre categorias). */
export type CategoryMetric = 'sets' | 'reps' | 'volumeKg' | 'minutes' | 'distanceKm';

export interface MetricsRepository {
  /** Totais da semana (segunda a domingo) para cada uma das categorias, por ordem fixa, com zeros nas sem atividade. */
  categoryWeek(weekStart: string): Promise<CategoryTotals[]>;
  /** Uma medida por semana, de uma categoria (ou de todas, se `category` for null), com zeros nas semanas vazias. */
  weeklyCategory(fromWeek: string, weeks: number, category: Category | null, metric: CategoryMetric): Promise<WeekValue[]>;
  /** Semana de segunda a domingo (hora local); weekStart = «YYYY-MM-DD» da segunda. Mais séries primeiro. */
  weeklySetsByMuscle(weekStart: string, secondaryWeight: number): Promise<MuscleSets[]>;
  mobilityWeek(weekStart: string): Promise<MobilityWeek>;
  /** Dias seguidos com mobilidade até hoje (se hoje ainda não fizeste, conta até ontem). */
  mobilityStreak(today: string): Promise<number>;
  /** Séries de trabalho de força (cada série conta uma vez) por semana, desde `fromWeek` (segunda) durante `weeks` semanas, com zeros nas semanas vazias. */
  weeklyStrengthSets(fromWeek: string, weeks: number): Promise<WeekValue[]>;
  /** Minutos de mobilidade por semana, no mesmo formato. */
  weeklyMobilityMinutes(fromWeek: string, weeks: number): Promise<WeekValue[]>;
  /** Séries de força feitas em [from, to) e os músculos (ids do spec) dos exercícios usados. */
  metricData(from: Date, to: Date): Promise<MetricData>;
  /** Resumo da semana (segunda a domingo): tempo ativo das sessões terminadas, sessões, exercícios distintos e séries de trabalho. */
  weekSummary(weekStart: string): Promise<WeekSummary>;
}

export interface WeekSummary {
  activeSeconds: number;
  sessions: number;
  exercises: number;
  /** Séries de trabalho (força e cardio); LEFT/RIGHT contam uma vez. */
  sets: number;
}

export interface MetricData {
  sets: MetricSet[];
  exercises: Map<string, MetricExercise>;
  /** Exercícios de força usados sem músculos primários (não contam para o volume). */
  withoutPrimary: string[];
}

export interface WeekValue {
  /** Segunda-feira da semana, «YYYY-MM-DD». */
  weekStart: string;
  value: number;
}

const WEEK_OF = `date(s.started_at, 'localtime', 'weekday 0', '-6 days')`;

export class SqliteMetricsRepository implements MetricsRepository {
  constructor(private readonly db: DbAdapter) {}

  async metricData(from: Date, to: Date): Promise<MetricData> {
    // LEFT e RIGHT da mesma série partilham a posição e contam como uma série: fica a linha com mais repetições.
    const rows = await this.db.query<{
      exercise_id: string; session_id: string; type: string; weight_kg: number | null; reps: number | null;
      rir: number | null; at: string;
    }>(
      `SELECT se.exercise_id, se.session_id, sl.type, sl.weight_kg, sl.reps, sl.rir, sl.completed_at AS at
         FROM set_log sl
         JOIN session_exercise se ON se.id = sl.session_exercise_id AND se.deleted_at IS NULL
         JOIN session s ON s.id = se.session_id AND s.deleted_at IS NULL
         JOIN exercise e ON e.id = se.exercise_id
        WHERE sl.deleted_at IS NULL AND sl.completed_at IS NOT NULL AND e.kind = 'STRENGTH'
          AND sl.reps IS NOT NULL AND sl.completed_at >= ? AND sl.completed_at < ?
          AND sl.id = (SELECT x.id FROM set_log x WHERE x.session_exercise_id = sl.session_exercise_id
                         AND x.position = sl.position AND x.deleted_at IS NULL
                       ORDER BY COALESCE(x.reps, 0) DESC, x.side LIMIT 1)
        ORDER BY sl.completed_at`,
      [from.toISOString(), to.toISOString()],
    );
    const sets: MetricSet[] = rows.map((r) => ({
      exerciseId: r.exercise_id, sessionId: r.session_id, weightKg: r.weight_kg ?? 0, reps: r.reps ?? 0, rir: r.rir,
      type: r.type === 'WARMUP' ? 'warmup' : 'working', performedAt: new Date(r.at),
    }));

    const specOfMuscleId = new Map<string, string>();
    for (const [key, spec] of Object.entries(SPEC_MUSCLE_OF_KEY)) specOfMuscleId.set(ids.muscle(key), spec);
    const exIds = [...new Set(sets.map((x) => x.exerciseId))];
    const exercises = new Map<string, MetricExercise>();
    for (const id of exIds) exercises.set(id, { id, primaryMuscles: [], secondaryMuscles: [] });
    if (exIds.length) {
      const marks = exIds.map(() => '?').join(',');
      const mus = await this.db.query<{ exercise_id: string; muscle_group_id: string; is_primary: number }>(
        `SELECT exercise_id, muscle_group_id, is_primary FROM exercise_muscle
          WHERE deleted_at IS NULL AND exercise_id IN (${marks})`,
        exIds,
      );
      for (const m of mus) {
        const spec = specOfMuscleId.get(m.muscle_group_id);
        if (!spec) continue;
        const ex = exercises.get(m.exercise_id)!;
        const list = m.is_primary ? ex.primaryMuscles : ex.secondaryMuscles;
        if (!list.includes(spec)) list.push(spec);
      }
      for (const ex of exercises.values()) ex.secondaryMuscles = ex.secondaryMuscles.filter((k) => !ex.primaryMuscles.includes(k));
      // O nome decide as exceções ao peso dos secundários (core/metrics/indirect.ts).
      const names = await this.db.query<{ id: string; name: string }>(`SELECT id, name FROM exercise WHERE id IN (${marks})`, exIds);
      for (const n of names) exercises.get(n.id)!.name = n.name;
    }
    const withoutPrimary = [...exercises.values()].filter((e) => !e.primaryMuscles.length).map((e) => e.id);
    return { sets, exercises, withoutPrimary };
  }

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

  private async categoryRows(where: string, params: unknown[]): Promise<Array<CategoryTotals & { week: string }>> {
    const rows = await this.db.query<{
      week: string; kind: Kind; category: string | null; sessions: number; exercises: number; sets: number;
      reps: number; volume: number; seconds: number; dist: number;
    }>(
      `SELECT ${WEEK_OF} AS week, e.kind AS kind, e.category AS category,
              COUNT(DISTINCT s.id) AS sessions, COUNT(DISTINCT se.exercise_id) AS exercises,
              COUNT(DISTINCT CASE WHEN sl.type = 'WORKING' THEN se.id || '#' || sl.position END) AS sets,
              SUM(CASE WHEN sl.type = 'WORKING' THEN COALESCE(sl.reps, 0) ELSE 0 END) AS reps,
              SUM(CASE WHEN sl.type = 'WORKING' THEN COALESCE(sl.weight_kg, 0) * COALESCE(sl.reps, 0) ELSE 0 END) AS volume,
              SUM(COALESCE(sl.duration_seconds, 0)) AS seconds,
              SUM(COALESCE(sl.distance_m, 0)) AS dist
         FROM set_log sl
         JOIN session_exercise se ON se.id = sl.session_exercise_id AND se.deleted_at IS NULL
         JOIN session s ON s.id = se.session_id AND s.deleted_at IS NULL
         JOIN exercise e ON e.id = se.exercise_id
        WHERE sl.deleted_at IS NULL AND sl.completed_at IS NOT NULL AND ${where}
        GROUP BY week, e.kind, e.category`,
      params as (string | number)[],
    );
    // category NULL (linhas antigas) soma-se à categoria por omissão do tipo
    const merged = new Map<string, CategoryTotals & { week: string }>();
    for (const r of rows) {
      const category = resolveCategory(r.kind, r.category);
      const key = `${r.week}|${category}`;
      const t = merged.get(key) ?? { week: r.week, category, sessions: 0, exercises: 0, sets: 0, reps: 0, volumeKg: 0, minutes: 0, distanceKm: 0 };
      t.sessions += r.sessions; t.exercises += r.exercises; t.sets += r.sets; t.reps += r.reps;
      t.volumeKg += r.volume; t.minutes += r.seconds / 60; t.distanceKm += r.dist / 1000;
      merged.set(key, t);
    }
    return [...merged.values()].map((t) => ({
      ...t, volumeKg: Math.round(t.volumeKg), minutes: Math.round(t.minutes * 10) / 10, distanceKm: Math.round(t.distanceKm * 100) / 100,
    }));
  }

  async categoryWeek(weekStart: string): Promise<CategoryTotals[]> {
    const rows = await this.categoryRows(`${WEEK_OF} = ?`, [weekStart]);
    return CATEGORIES.map((category) => {
      const r = rows.find((x) => x.category === category);
      return r
        ? { category, sessions: r.sessions, exercises: r.exercises, sets: r.sets, reps: r.reps, volumeKg: r.volumeKg, minutes: r.minutes, distanceKm: r.distanceKm }
        : { category, sessions: 0, exercises: 0, sets: 0, reps: 0, volumeKg: 0, minutes: 0, distanceKm: 0 };
    });
  }

  async weeklyCategory(fromWeek: string, weeks: number, category: Category | null, metric: CategoryMetric): Promise<WeekValue[]> {
    const rows = await this.categoryRows(`${WEEK_OF} >= ?`, [fromWeek]);
    const byWeek = new Map<string, number>();
    for (const r of rows) {
      if (category && r.category !== category) continue;
      byWeek.set(r.week, (byWeek.get(r.week) ?? 0) + r[metric]);
    }
    for (const [w, v] of byWeek) byWeek.set(w, Math.round(v * 100) / 100);
    return fillWeeks(fromWeek, weeks, byWeek);
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

  async weekSummary(weekStart: string): Promise<WeekSummary> {
    const a = await this.db.query<{ n: number; secs: number | null }>(
      `SELECT COUNT(*) AS n,
              SUM(MAX(0, (julianday(s.ended_at) - julianday(s.started_at)) * 86400 - s.paused_seconds)) AS secs
         FROM session s
        WHERE s.deleted_at IS NULL AND s.ended_at IS NOT NULL AND ${WEEK_OF} = ?`,
      [weekStart],
    );
    const b = await this.db.query<{ ex: number; sets: number }>(
      `SELECT COUNT(DISTINCT se.exercise_id) AS ex,
              COUNT(DISTINCT CASE WHEN sl.type = 'WORKING' THEN se.id || '#' || sl.position END) AS sets
         FROM set_log sl
         JOIN session_exercise se ON se.id = sl.session_exercise_id AND se.deleted_at IS NULL
         JOIN session s ON s.id = se.session_id AND s.deleted_at IS NULL
        WHERE sl.deleted_at IS NULL AND sl.completed_at IS NOT NULL AND ${WEEK_OF} = ?`,
      [weekStart],
    );
    return { activeSeconds: Math.round(a[0].secs ?? 0), sessions: a[0].n, exercises: b[0].ex, sets: b[0].sets };
  }

  async weeklyStrengthSets(fromWeek: string, weeks: number): Promise<WeekValue[]> {
    const rows = await this.db.query<{ week: string; n: number }>(
      `WITH series AS (
         SELECT DISTINCT sl.session_exercise_id, sl.position
         FROM set_log sl
         WHERE sl.type = 'WORKING' AND sl.completed_at IS NOT NULL AND sl.deleted_at IS NULL
       )
       SELECT ${WEEK_OF} AS week, COUNT(*) AS n
       FROM series x
       JOIN session_exercise se ON se.id = x.session_exercise_id AND se.deleted_at IS NULL
       JOIN session s ON s.id = se.session_id AND s.deleted_at IS NULL
       JOIN exercise e ON e.id = se.exercise_id AND e.kind = 'STRENGTH'
       WHERE ${WEEK_OF} >= ?
       GROUP BY week`,
      [fromWeek],
    );
    return fillWeeks(fromWeek, weeks, new Map(rows.map((r) => [r.week, r.n])));
  }

  async weeklyMobilityMinutes(fromWeek: string, weeks: number): Promise<WeekValue[]> {
    const rows = await this.db.query<{ week: string; seconds: number | null }>(
      `SELECT ${WEEK_OF} AS week, SUM(sl.duration_seconds) AS seconds
       FROM set_log sl
       JOIN session_exercise se ON se.id = sl.session_exercise_id AND se.deleted_at IS NULL
       JOIN session s ON s.id = se.session_id AND s.deleted_at IS NULL
       JOIN exercise e ON e.id = se.exercise_id AND e.kind = 'MOBILITY'
       WHERE sl.deleted_at IS NULL AND sl.completed_at IS NOT NULL AND ${WEEK_OF} >= ?
       GROUP BY week`,
      [fromWeek],
    );
    return fillWeeks(fromWeek, weeks, new Map(rows.map((r) => [r.week, Math.round(((r.seconds ?? 0) / 60) * 10) / 10])));
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

function fillWeeks(fromWeek: string, weeks: number, byWeek: Map<string, number>): WeekValue[] {
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(fromWeek, i * 7);
    return { weekStart, value: byWeek.get(weekStart) ?? 0 };
  });
}
