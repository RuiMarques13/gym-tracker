import { reliable1RM } from './one-rm';
import { VOLUME_RULES, VolumeRules } from './volume-rules';

export type Goal = 'hypertrophy' | 'strength' | 'power' | 'endurance' | 'maintenance' | 'cut';
export type Level = 'beginner' | 'intermediate' | 'advanced';

export interface MetricExercise {
  id: string;
  /** Ids do spec (ver muscles.ts). */
  primaryMuscles: string[];
  secondaryMuscles: string[];
}

export interface MetricSet {
  exerciseId: string;
  weightKg: number;
  reps: number;
  rir: number | null;
  type: 'warmup' | 'working';
  performedAt: Date;
  sessionId: string;
}

export interface MetricProfile {
  goal: Goal;
  level: Level;
  birthYear: number | null;
  goalChangedAt: Date;
}

export interface Range {
  min: number;
  target: number;
  max: number;
}
export type Status = 'below' | 'ok' | 'above';
export interface Recommendation {
  muscle: string;
  sets: number;
  frequency: number;
  range: Range;
  status: Status;
  message: string;
}

const DAY = 86_400_000;

export function isEffective(s: MetricSet, r: VolumeRules = VOLUME_RULES): boolean {
  return (
    s.type === 'working' &&
    s.reps >= r.effective_set.reps_min &&
    s.reps <= r.effective_set.reps_max &&
    (s.rir === null || s.rir <= r.effective_set.rir_max)
  );
}

/** Séries fracionais e frequência por músculo numa janela [from, to). Exercícios sem músculos primários não contam. */
export function weeklyVolume(
  sets: MetricSet[],
  exercises: Map<string, MetricExercise>,
  from: Date,
  to: Date,
  rules: VolumeRules = VOLUME_RULES,
  onMissing?: (exerciseId: string) => void,
): { sets: Map<string, number>; freq: Map<string, number> } {
  const vol = new Map<string, number>();
  const sessions = new Map<string, Set<string>>();
  for (const s of sets) {
    if (s.performedAt < from || s.performedAt >= to || !isEffective(s, rules)) continue;
    const ex = exercises.get(s.exerciseId);
    if (!ex) continue;
    if (!ex.primaryMuscles.length) {
      onMissing?.(ex.id);
      continue;
    }
    for (const m of ex.primaryMuscles) {
      vol.set(m, (vol.get(m) ?? 0) + 1);
      if (!sessions.has(m)) sessions.set(m, new Set());
      sessions.get(m)!.add(s.sessionId);
    }
    for (const m of ex.secondaryMuscles) vol.set(m, (vol.get(m) ?? 0) + rules.indirect_set_weight);
  }
  return { sets: vol, freq: new Map([...sessions].map(([m, ids]) => [m, ids.size])) };
}

export interface WeekProgressPoint {
  /** 0 = início da segunda; 1..7 = fim de cada dia. */
  x: number;
  /** Ritmo para chegar ao alvo no domingo (reta). */
  pace: number;
  /** Séries feitas até ao fim desse dia (cada músculo limitado ao seu alvo); null nos dias que ainda não chegaram. */
  real: number | null;
}

export interface WeekProgress {
  /** Soma dos alvos semanais por músculo. */
  target: number;
  /** Feito até agora (cada músculo limitado ao seu alvo). */
  done: number;
  /** 0..6: dia de hoje na semana (segunda = 0). */
  today: number;
  points: WeekProgressPoint[];
}

/**
 * Alvo da semana (segunda a domingo) contra o progresso real, dia a dia. O progresso soma, por músculo, as séries
 * fracionais feitas desde segunda, limitadas ao alvo desse músculo (como o resto da app: passar do alvo não «compensa»
 * outro músculo em falta).
 */
export function weekProgress(
  sets: MetricSet[],
  exercises: Map<string, MetricExercise>,
  targets: ReadonlyMap<string, number>,
  weekStart: Date,
  now: Date,
  rules: VolumeRules = VOLUME_RULES,
): WeekProgress {
  const target = [...targets.values()].reduce((n, t) => n + t, 0);
  const dayStart = (i: number) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const today = Math.min(6, Math.max(0, Math.round((sod.getTime() - dayStart(0).getTime()) / DAY)));
  const doneAt = (end: Date) => {
    const { sets: vol } = weeklyVolume(sets, exercises, dayStart(0), end, rules);
    let n = 0;
    for (const [m, t] of targets) n += Math.min(vol.get(m) ?? 0, t);
    return Math.round(n * 10) / 10;
  };
  const points: WeekProgressPoint[] = [{ x: 0, pace: 0, real: 0 }];
  for (let i = 0; i < 7; i++) {
    const end = i === today ? now : dayStart(i + 1);
    points.push({ x: i + 1, pace: Math.round(((target * (i + 1)) / 7) * 10) / 10, real: i <= today ? doneAt(end) : null });
  }
  return { target: Math.round(target * 10) / 10, done: points[today + 1].real ?? 0, today, points };
}

/** e1RM (Epley, a fórmula única da app: core/metrics/one-rm.ts), só com ≤ 10 repetições contando as de reserva. */
export function e1rm(s: Pick<MetricSet, 'weightKg' | 'reps' | 'rir'>): number | null {
  return reliable1RM(s.weightKg, s.reps, s.rir);
}

/** Variação média do melhor e1RM semanal dos exercícios principais, da mais antiga para a mais recente. */
export function performanceTrend(sets: MetricSet[], mainExerciseIds: string[], now: Date, weeks = 3): number[] {
  const best = (exId: string, from: Date, to: Date) =>
    Math.max(
      0,
      ...sets
        .filter((s) => s.exerciseId === exId && s.type === 'working' && s.performedAt >= from && s.performedAt < to)
        .map((s) => e1rm(s) ?? 0),
    );
  const changes: number[] = [];
  for (let w = weeks; w >= 1; w--) {
    const curFrom = new Date(now.getTime() - w * 7 * DAY);
    const curTo = new Date(curFrom.getTime() + 7 * DAY);
    const prevFrom = new Date(curFrom.getTime() - 7 * DAY);
    const deltas = mainExerciseIds
      .map((id) => [best(id, prevFrom, curFrom), best(id, curFrom, curTo)])
      .filter(([a, b]) => a > 0 && b > 0)
      .map(([a, b]) => (b - a) / a);
    if (deltas.length) changes.push(deltas.reduce((x, y) => x + y, 0) / deltas.length);
  }
  return changes;
}

/** Volume médio semanal por músculo nas `weeks` semanas antes de `until`. */
export function previousVolume(
  sets: MetricSet[],
  ex: Map<string, MetricExercise>,
  until: Date,
  weeks = 4,
  rules: VolumeRules = VOLUME_RULES,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (let w = 1; w <= weeks; w++) {
    const to = new Date(until.getTime() - (w - 1) * 7 * DAY);
    const from = new Date(to.getTime() - 7 * DAY);
    for (const [m, v] of weeklyVolume(sets, ex, from, to, rules).sets) totals.set(m, (totals.get(m) ?? 0) + v / weeks);
  }
  return totals;
}

export function rangeFor(
  profile: MetricProfile,
  muscle: string,
  prev: Map<string, number>,
  dropWeeks: number,
  now: Date,
  rules: VolumeRules = VOLUME_RULES,
): Range {
  // Força: nenhuma fonte aberta dá séries por músculo por semana; a app usa as faixas da hipertrofia (escolha da app).
  if (profile.goal !== 'maintenance' && profile.goal !== 'cut') return rules.goals.hypertrophy[profile.level];
  if (profile.goal === 'maintenance') {
    const age = profile.birthYear === null ? 0 : now.getFullYear() - profile.birthYear;
    if (age >= 60) return rules.goals.maintenance['60_plus'];
    const r = rules.goals.maintenance.under_60;
    const p = prev.get(muscle);
    const target = p ? Math.max(r.min, Math.round(p * r.target_ratio_of_previous)) : r.min;
    return { min: r.min, target, max: r.max };
  }
  const r = rules.goals.cut.any;
  let target = Math.min(r.max, Math.max(r.min, Math.round(prev.get(muscle) ?? r.min)));
  if (dropWeeks >= r.on_performance_drop_weeks) target = Math.max(r.min, Math.round(target * (1 - r.volume_reduction)));
  return { min: r.min, target, max: r.max };
}

export function recommend(
  profile: MetricProfile,
  sets: MetricSet[],
  exercises: Map<string, MetricExercise>,
  muscles: { id: string; label: string }[],
  mainExerciseIds: string[],
  now = new Date(),
  rules: VolumeRules = VOLUME_RULES,
): Recommendation[] {
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const { sets: vol, freq } = weeklyVolume(sets, exercises, weekAgo, now, rules);
  const prev = previousVolume(sets, exercises, profile.goalChangedAt, 4, rules);

  let dropWeeks = 0;
  if (profile.goal === 'cut') {
    const trend = performanceTrend(sets, mainExerciseIds, now);
    for (const c of [...trend].reverse()) {
      if (c < -0.02) dropWeeks++;
      else break;
    }
  }
  const dropped = profile.goal === 'cut' && dropWeeks >= rules.goals.cut.any.on_performance_drop_weeks;

  return muscles.map(({ id: muscle, label }) => {
    const done = Math.round((vol.get(muscle) ?? 0) * 10) / 10;
    const f = freq.get(muscle) ?? 0;
    const range = rangeFor(profile, muscle, prev, dropWeeks, now, rules);
    const status: Status = done < range.min ? 'below' : done > range.max ? 'above' : 'ok';
    const msg =
      status === 'below'
        ? `Adiciona ~${Math.ceil(range.target - done)} séries de ${label} esta semana.`
        : status === 'above'
          ? `Volume de ${label} acima do máximo (${range.max}). Considera reduzir para ~${range.target}.`
          : `Volume de ${label} dentro da faixa.`;
    const freqMsg = f < 2 && profile.goal !== 'maintenance' && done > 0 ? ' Divide por pelo menos 2 sessões.' : '';
    const cutMsg = dropped ? ' Performance a cair: volume reduzido 25%, mantém a carga.' : '';
    return { muscle, sets: done, frequency: f, range, status, message: msg + freqMsg + cutMsg };
  });
}

/** Aviso intra-sessão: demasiadas séries diretas (primárias) para um músculo. */
export function sessionWarnings(
  sessionSets: MetricSet[],
  exercises: Map<string, MetricExercise>,
  labels: Record<string, string> = {},
  rules: VolumeRules = VOLUME_RULES,
): string[] {
  const direct = new Map<string, number>();
  for (const s of sessionSets) {
    if (!isEffective(s, rules)) continue;
    for (const m of exercises.get(s.exerciseId)?.primaryMuscles ?? []) direct.set(m, (direct.get(m) ?? 0) + 1);
  }
  return [...direct]
    .filter(([, n]) => n > rules.max_direct_sets_per_session)
    .map(
      ([m, n]) =>
        `${n} séries diretas de ${labels[m] ?? m} nesta sessão; acima de ${rules.max_direct_sets_per_session}, a app sugere repartir por outro dia.`,
    );
}

export const sessionLoad = (rpe: number | null, min: number): number | null => (rpe == null ? null : rpe * min);
