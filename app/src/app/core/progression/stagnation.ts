import { reliable1RM } from '../metrics/one-rm';
import type { LoadSet } from './load';

/**
 * Estagnação de um exercício e a resposta seguinte (especificação «Progressão e ciclos», «Mudar o estímulo»).
 *
 * Deteção (escolha da app, editável): N sessões seguidas (3 por defeito) sem subir a carga máxima, sem subir
 * repetições nessa carga e sem melhorar o 1RM estimado. Só contam sessões com 2 ou mais séries de trabalho.
 * Respostas, por ordem: descarga se há fadiga (Bell 2023), mais ~20% de séries até ao máximo do nível (IUSCA 2021),
 * outra faixa de repetições (Lopez 2021), trocar o exercício (Kassiano 2022). Ver rules.ts.
 */

export interface StagSession {
  /** Id da sessão. */
  id: string;
  at: string;
  /** Séries de trabalho (os dois lados nos unilaterais). */
  sets: LoadSet[];
}

export interface StagnationResult {
  stagnated: boolean;
  /** Sessões válidas depois da última com progresso. */
  sessionsWithout: number;
  /** Sessão do último progresso (identifica o episódio de estagnação). */
  episode: string | null;
}

export const STAGNATION = {
  /** Escolha da app: séries de trabalho mínimas para a sessão contar. */
  minWorkingSets: 2,
  /** Sessões a mais, além do limiar, olhadas para trás (um recorde antigo não conta para sempre). */
  lookBack: 3,
} as const;

const EPS = 1e-6;

interface Best {
  topW: number;
  repsAtTop: number;
  e1: number | null;
}

function bestOf(s: StagSession): Best {
  const loaded = s.sets.filter((x) => (x.weightKg ?? 0) > 0 && (x.reps ?? 0) > 0);
  const topW = Math.max(0, ...loaded.map((x) => x.weightKg!));
  const repsAtTop = Math.max(0, ...loaded.filter((x) => Math.abs(x.weightKg! - topW) < EPS).map((x) => x.reps!));
  const e1s = loaded.map((x) => reliable1RM(x.weightKg, x.reps, x.rir)).filter((v): v is number => v !== null);
  return { topW, repsAtTop, e1: e1s.length ? Math.max(...e1s) : null };
}

/** A sessão supera o melhor até aqui? (mais carga, mais repetições na mesma carga, ou 1RM estimado maior) */
export function beats(best: Best, s: Best): boolean {
  if (s.topW > best.topW + EPS) return true;
  if (Math.abs(s.topW - best.topW) < EPS && s.repsAtTop > best.repsAtTop) return true;
  return s.e1 !== null && best.e1 !== null && s.e1 > best.e1 + EPS;
}

function merge(a: Best, b: Best): Best {
  const repsAtTop = b.topW > a.topW + EPS ? b.repsAtTop : Math.abs(b.topW - a.topW) < EPS ? Math.max(a.repsAtTop, b.repsAtTop) : a.repsAtTop;
  return {
    topW: Math.max(a.topW, b.topW),
    repsAtTop,
    e1: a.e1 === null ? b.e1 : b.e1 === null ? a.e1 : Math.max(a.e1, b.e1),
  };
}

/** `history` da sessão mais recente para a mais antiga. */
export function detectStagnation(history: StagSession[], threshold = 3): StagnationResult {
  const q = history
    .filter((s) => s.sets.filter((x) => (x.weightKg ?? 0) > 0 && (x.reps ?? 0) > 0).length >= STAGNATION.minWorkingSets)
    .slice(0, threshold + STAGNATION.lookBack)
    .reverse();
  if (q.length < threshold + 1) return { stagnated: false, sessionsWithout: 0, episode: null };
  let best = bestOf(q[0]);
  let last = 0;
  for (let i = 1; i < q.length; i++) {
    const b = bestOf(q[i]);
    if (beats(best, b)) last = i;
    best = merge(best, b);
  }
  const sessionsWithout = q.length - 1 - last;
  return { stagnated: sessionsWithout >= threshold, sessionsWithout, episode: q[last].id };
}

export type StimulusResponse = 'deload' | 'volume' | 'range' | 'swap';

/**
 * A resposta seguinte. `done`: respostas já aceites neste episódio (cada uma conta para a seguinte enquanto o
 * exercício não voltar a progredir).
 */
export function nextResponse(i: { fatigue: boolean; weeklySets: number; maxSets: number; done: readonly StimulusResponse[] }): StimulusResponse {
  if (i.fatigue && !i.done.includes('deload')) return 'deload';
  if (!i.done.includes('volume') && i.weeklySets < i.maxSets) return 'volume';
  if (!i.done.includes('range')) return 'range';
  return 'swap';
}

/** +~20% das séries semanais do músculo (pelo menos +1), sem passar o máximo do nível. */
export function volumePlan(weeklySets: number, maxSets: number): { from: number; to: number; extra: number } {
  const from = Math.round(weeklySets);
  const to = Math.min(maxSets, Math.max(from + 1, Math.round(weeklySets * 1.2)));
  return { from, to, extra: Math.max(0, to - from) };
}

/** Faixas alternativas (escolha da app, exemplos da especificação): 5–8, 8–12 e 12–20, sem a atual. */
export const RANGES: [number, number][] = [[5, 8], [8, 12], [12, 20]];
export function rangeOptions(min: number, max: number): [number, number][] {
  return RANGES.filter(([a, b]) => !(a === min && b === max)).filter(([a, b]) => !(min >= a && max <= b)).slice(0, 2);
}
