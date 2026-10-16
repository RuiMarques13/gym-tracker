import type { MetricExercise, MetricSet } from './volume';
import { isEffective } from './volume';

/**
 * Descanso recomendado por músculo. Estimativa simples e transparente (não é ciência exata):
 * parte de uma janela base pelo tamanho do músculo, sobe com o volume da última sessão e com o esforço
 * (RIR baixo), e ajusta-se pela dor que indicares (1 sem dor … 5 muito dorido).
 * Todos os números são escolha da app, sem fonte aberta: rules.ts `recovery.window`, `recovery.rir`, `recovery.soreness`.
 * Orientação geral de treino, não aconselhamento médico.
 */
const HOUR = 3_600_000;

/** Horas de descanso mínimas e máximas (com pouco e com muito volume) por músculo. */
const BASE_HOURS: Record<string, [number, number]> = {
  peito: [48, 72], costas_dorsais: [48, 72], costas_superiores: [48, 72], quadriceps: [48, 72], isquiotibiais: [48, 72],
  gluteos: [48, 72], lombares: [48, 72],
  deltoide_anterior: [24, 48], deltoide_lateral: [24, 48], deltoide_posterior: [24, 48], biceps: [24, 48], triceps: [24, 48],
  antebracos: [24, 48], gemeos: [24, 48], adutores: [24, 48], abdominais: [24, 48],
};

/** Horas a somar (ou tirar) conforme a dor. */
export const SORENESS_ADJUST: Record<number, number> = { 1: -6, 2: 0, 3: 12, 4: 24, 5: 36 };
export const SORENESS_LABEL: Record<number, string> = { 1: 'Sem dor', 2: 'Ligeira', 3: 'Moderada', 4: 'Forte', 5: 'Muito forte' };

export interface Stimulus {
  muscle: string;
  /** Séries efetivas fracionais na última sessão que treinou o músculo. */
  sets: number;
  /** RIR médio das séries com RIR registado; null se nenhuma tinha. */
  avgRir: number | null;
  /** Fim do estímulo (última série desse músculo). */
  at: Date;
}

export interface Soreness {
  muscle: string;
  /** Dia em que a indicaste (YYYY-MM-DD). */
  date: string;
  level: number;
}

export type RecoveryStatus = 'ready' | 'recovering';
export interface RestAdvice {
  muscle: string;
  status: RecoveryStatus;
  /** Horas de descanso recomendadas no total, desde a última série. */
  hoursNeeded: number;
  /** Horas que faltam (0 se já está pronto). */
  hoursLeft: number;
  readyAt: Date;
  lastTrainedAt: Date;
  sets: number;
  reasons: string[];
}

/** O último estímulo de cada músculo: a sessão mais recente com séries efetivas dele, nos últimos `days` dias. */
export function lastStimuli(sets: MetricSet[], exercises: Map<string, MetricExercise>, now: Date, days = 7, secondaryWeight = 0.5): Stimulus[] {
  const from = now.getTime() - days * 24 * HOUR;
  const perMuscle = new Map<string, Map<string, { sets: number; rirs: number[]; at: number }>>();
  for (const s of sets) {
    const t = s.performedAt.getTime();
    if (t < from || t > now.getTime() || !isEffective(s)) continue;
    const ex = exercises.get(s.exerciseId);
    if (!ex) continue;
    const add = (m: string, w: number) => {
      const bySession = perMuscle.get(m) ?? new Map();
      perMuscle.set(m, bySession);
      const cur = bySession.get(s.sessionId) ?? { sets: 0, rirs: [], at: 0 };
      cur.sets += w;
      if (s.rir !== null && w === 1) cur.rirs.push(s.rir);
      cur.at = Math.max(cur.at, t);
      bySession.set(s.sessionId, cur);
    };
    for (const m of ex.primaryMuscles) add(m, 1);
    for (const m of ex.secondaryMuscles) add(m, secondaryWeight);
  }
  const out: Stimulus[] = [];
  for (const [muscle, bySession] of perMuscle) {
    const latest = [...bySession.values()].sort((a, b) => b.at - a.at)[0];
    out.push({
      muscle, sets: latest.sets, at: new Date(latest.at),
      avgRir: latest.rirs.length ? latest.rirs.reduce((x, y) => x + y, 0) / latest.rirs.length : null,
    });
  }
  return out;
}

const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function adviceFor(stimulus: Stimulus, soreness: Soreness | undefined, now: Date): RestAdvice {
  const [lo, hi] = BASE_HOURS[stimulus.muscle] ?? [48, 72];
  const reasons: string[] = [];
  // volume: 3 séries ou menos → janela baixa; 10 ou mais → janela alta
  const load = Math.min(1, Math.max(0, (stimulus.sets - 3) / 7));
  let hours = lo + (hi - lo) * load;
  reasons.push(`${round1(stimulus.sets)} séries na última sessão`);
  if (stimulus.avgRir !== null && stimulus.avgRir <= 1) {
    hours += 12;
    reasons.push('séries perto da falha (+12 h)');
  }
  // a dor só conta se foi indicada depois do treino
  if (soreness && soreness.date >= localDay(stimulus.at)) {
    const adj = SORENESS_ADJUST[soreness.level] ?? 0;
    hours += adj;
    if (adj !== 0) reasons.push(`dor ${SORENESS_LABEL[soreness.level].toLowerCase()} (${adj > 0 ? '+' : ''}${adj} h)`);
  }
  hours = Math.max(12, Math.round(hours));
  const readyAt = new Date(stimulus.at.getTime() + hours * HOUR);
  const left = Math.max(0, Math.ceil((readyAt.getTime() - now.getTime()) / HOUR));
  return {
    muscle: stimulus.muscle, status: left === 0 ? 'ready' : 'recovering', hoursNeeded: hours, hoursLeft: left,
    readyAt, lastTrainedAt: stimulus.at, sets: round1(stimulus.sets), reasons,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Conselhos para os músculos treinados recentemente: os que ainda recuperam primeiro (por tempo em falta). */
export function restAdvice(stimuli: Stimulus[], sorenessLog: Soreness[], now: Date): RestAdvice[] {
  const latestSoreness = new Map<string, Soreness>();
  for (const s of sorenessLog) {
    const cur = latestSoreness.get(s.muscle);
    if (!cur || s.date > cur.date) latestSoreness.set(s.muscle, s);
  }
  return stimuli
    .map((st) => adviceFor(st, latestSoreness.get(st.muscle), now))
    .sort((a, b) => b.hoursLeft - a.hoursLeft || b.sets - a.sets);
}

/** «em 14 h», «amanhã», «em 2 dias». */
export function formatWait(hours: number): string {
  if (hours <= 0) return 'pronto';
  if (hours < 24) return `em ${hours} h`;
  const d = Math.round(hours / 24);
  return d === 1 ? 'em ~1 dia' : `em ~${d} dias`;
}
