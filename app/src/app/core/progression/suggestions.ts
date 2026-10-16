import type { Goal, Level, MetricExercise, MetricSet } from '../metrics/volume';
import { previousVolume, weeklyVolume } from '../metrics/volume';
import { VOLUME_RULES } from '../metrics/volume-rules';
import { usesHypertrophyVolume } from './goals';
import { detectStagnation, nextResponse, type StagSession, type StimulusResponse } from './stagnation';

/**
 * Decisões dos cartões de sugestão (estagnação e fadiga), sem acesso à base: o ProgressionService lê o histórico,
 * chama estas funções e aplica o que aceitares. Especificação «Progressão e ciclos», fase 3; regras em rules.ts.
 */

const DAY = 86_400_000;

/**
 * Janelas e limites. Todos são escolha da app (sem número na literatura): definem quanto histórico se olha e
 * quantos cartões aparecem, não a dose de treino. Ver rules.ts, `suggest.windows`.
 */
export const SUGGEST = {
  /** Histórico de séries lido para detetar estagnação e fadiga. */
  historyDays: 180,
  /** Respostas antigas (aceites/recusadas) consideradas. */
  responsesDays: 365,
  /** Na Home, só exercícios feitos nos últimos N dias. */
  recentDays: 14,
  /** Na Home, no máximo N cartões de estagnação (os parados há mais tempo); os outros aparecem no fim da sessão. */
  homeMax: 3,
  /** Exercícios «principais» para a tendência do 1RM: os N com mais séries de trabalho. */
  mainExercises: 5,
  /** Sessões recentes cujo RIR conta para o sinal de fadiga. */
  rirSessions: 2,
  /** Dias de dor muscular considerados. */
  sorenessDays: 3,
  /** Semanas da média de volume (comparada com a última semana; conta a maior). */
  volumeAvgWeeks: 4,
} as const;

/** O que a lógica precisa de uma resposta já dada (subconjunto de SuggestionRecord). */
export interface PastResponse {
  kind: 'STAGNATION' | 'FATIGUE';
  exerciseId: string | null;
  episode: string;
  response: StimulusResponse | null;
  status: 'ACCEPTED' | 'DECLINED';
  createdAt: string;
}

/** Séries de trabalho de um exercício agrupadas por sessão, da mais recente para a mais antiga. */
export function sessionsOf(sets: MetricSet[], exerciseId: string): StagSession[] {
  const by = new Map<string, StagSession>();
  for (const s of sets) {
    if (s.exerciseId !== exerciseId || s.type !== 'working') continue;
    let e = by.get(s.sessionId);
    if (!e) by.set(s.sessionId, (e = { id: s.sessionId, at: s.performedAt.toISOString(), sets: [] }));
    if (s.performedAt.toISOString() < e.at) e.at = s.performedAt.toISOString();
    e.sets.push({ weightKg: s.weightKg, reps: s.reps, rir: s.rir });
  }
  return [...by.values()].sort((a, b) => (a.at < b.at ? 1 : -1));
}

/** Sessões válidas (2+ séries de trabalho) depois de uma data ISO. */
export function countAfter(sessions: StagSession[], iso: string): number {
  return sessions.filter((x) => x.at > iso && x.sets.length >= 2).length;
}

/** Exercícios com séries de trabalho nos últimos `days` dias (os da Home). */
export function recentExerciseIds(working: MetricSet[], now: Date, days: number = SUGGEST.recentDays): string[] {
  const from = now.getTime() - days * DAY;
  return [...new Set(working.filter((s) => s.performedAt.getTime() >= from).map((s) => s.exerciseId))];
}

/**
 * Séries semanais por músculo: a maior entre a última semana e a média das últimas 4.
 * Uma semana a meio (ou falhada) não faz parecer que o volume caiu.
 */
export function weeklySetsByMuscle(sets: MetricSet[], exercises: Map<string, MetricExercise>, now: Date): Map<string, number> {
  const lastWeek = weeklyVolume(sets, exercises, new Date(now.getTime() - 7 * DAY), now).sets;
  const avg = previousVolume(sets, exercises, now, SUGGEST.volumeAvgWeeks);
  const muscles = new Set([...lastWeek.keys(), ...avg.keys()]);
  return new Map([...muscles].map((m) => [m, Math.max(lastWeek.get(m) ?? 0, avg.get(m) ?? 0)]));
}

/** Máximo de séries por músculo e RIR mínimo do objetivo e nível (volume-rules.ts). */
export function goalVolumeLimits(goal: Goal, level: Level): { maxSets: number; rirMin: number } {
  if (usesHypertrophyVolume(goal)) {
    const r = VOLUME_RULES.goals.hypertrophy[level];
    return { maxSets: r.max, rirMin: r.rir[0] };
  }
  if (goal === 'cut') return { maxSets: VOLUME_RULES.goals.cut.any.max, rirMin: VOLUME_RULES.goals.cut.any.rir[0] };
  const m = VOLUME_RULES.goals.maintenance.under_60;
  return { maxSets: m.max, rirMin: m.rir[0] };
}

/** Os N exercícios com mais séries de trabalho (para a tendência do 1RM). */
export function mainExerciseIds(working: MetricSet[], n: number = SUGGEST.mainExercises): string[] {
  const count = new Map<string, number>();
  for (const s of working) count.set(s.exerciseId, (count.get(s.exerciseId) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1]).slice(0, n).map(([id]) => id);
}

/** RIR das séries de trabalho das N sessões mais recentes, uma lista por sessão. */
export function recentSessionsRir(working: MetricSet[], n: number = SUGGEST.rirSessions): (number | null)[][] {
  const bySession = new Map<string, MetricSet[]>();
  for (const s of working) {
    const list = bySession.get(s.sessionId) ?? [];
    list.push(s);
    bySession.set(s.sessionId, list);
  }
  const latest = (l: MetricSet[]) => Math.max(...l.map((s) => s.performedAt.getTime()));
  return [...bySession.values()]
    .sort((a, b) => latest(b) - latest(a))
    .slice(0, n)
    .map((list) => list.map((s) => s.rir));
}

export interface StagnationDecision {
  episode: string;
  response: StimulusResponse;
  /** Sessões válidas sem progresso (ordena os cartões). */
  sessionsWithout: number;
}

/**
 * Decide se um exercício leva cartão de estagnação e com que resposta (rules.ts `stagnation.order`):
 * - sem estagnação: nada;
 * - depois de aceitares uma resposta, a seguinte só vem com nova estagnação (N sessões sem progresso depois disso);
 * - a resposta segue a ordem descarga → volume → faixa → troca;
 * - recusar esconde essa resposta até nova deteção (outro episódio).
 */
export function stagnationDecision(i: {
  sessions: StagSession[];
  threshold: number;
  /** Respostas já dadas para este exercício (qualquer episódio). */
  responses: PastResponse[];
  fatigue: boolean;
  weeklySets: number;
  maxSets: number;
}): StagnationDecision | null {
  const stag = detectStagnation(i.sessions, i.threshold);
  if (!stag.stagnated || !stag.episode) return null;
  const episode = stag.episode;
  const mine = i.responses.filter((h) => h.kind === 'STAGNATION' && h.episode === episode);
  const accepted = mine.filter((h) => h.status === 'ACCEPTED');
  const lastAccepted = accepted.reduce<string | null>((m, h) => (!m || h.createdAt > m ? h.createdAt : m), null);
  if (lastAccepted && countAfter(i.sessions, lastAccepted) < i.threshold) return null;
  const done = accepted.map((h) => h.response).filter((r): r is StimulusResponse => !!r);
  const response = nextResponse({ fatigue: i.fatigue, weeklySets: i.weeklySets, maxSets: i.maxSets, done });
  if (mine.some((h) => h.status === 'DECLINED' && h.response === response)) return null;
  return { episode, response, sessionsWithout: stag.sessionsWithout };
}

/** Ordena os cartões pelos parados há mais tempo e, na Home, fica com os primeiros `SUGGEST.homeMax`. */
export function pickStagnationCards<T extends { sessionsWithout: number }>(cards: T[], home: boolean): T[] {
  const sorted = [...cards].sort((a, b) => b.sessionsWithout - a.sessionsWithout);
  return home ? sorted.slice(0, SUGGEST.homeMax) : sorted;
}
