import { addDays, weekDays, weekStartOf } from '../util/week';

/**
 * Sequência semanal (rules.ts, `streak.week`; escolha da app): uma semana, de segunda a domingo, conta quando tem
 * pelo menos `goal` dias com treino terminado. É por semana para não empurrar a treinar sem recuperar: os dias de
 * descanso nunca a quebram. A semana em curso só soma quando já cumpriu; enquanto não, não quebra a sequência.
 */

export interface WeekStreak {
  /** Semanas seguidas a cumprir, contando a atual se já cumpriu. */
  weeks: number;
  /** Dias com treino nesta semana. */
  thisWeek: number;
  goal: number;
  /** Esta semana já cumpriu. */
  thisWeekDone: boolean;
  /** Os 7 dias desta semana («YYYY-MM-DD»), com treino ou não. */
  days: { date: string; trained: boolean; today: boolean; future: boolean }[];
}

/** Limite de semanas para trás (evita ciclos sem fim; ~10 anos). */
const MAX_WEEKS = 520;

/** `trainedDays`: datas locais «YYYY-MM-DD» das sessões terminadas (repetidas contam uma vez). */
export function weeklyStreak(trainedDays: readonly string[], today: string, goal: number): WeekStreak {
  const g = Math.max(1, Math.round(goal));
  const perWeek = new Map<string, Set<string>>();
  for (const d of trainedDays) {
    const w = weekStartOf(d);
    perWeek.set(w, (perWeek.get(w) ?? new Set()).add(d));
  }
  const current = weekStartOf(today);
  const thisWeek = perWeek.get(current)?.size ?? 0;
  const thisWeekDone = thisWeek >= g;
  let weeks = thisWeekDone ? 1 : 0;
  let w = addDays(current, -7);
  for (let i = 0; i < MAX_WEEKS && (perWeek.get(w)?.size ?? 0) >= g; i++) {
    weeks++;
    w = addDays(w, -7);
  }
  const done = perWeek.get(current) ?? new Set<string>();
  const days = weekDays(current).map((date) => ({ date, trained: done.has(date), today: date === today, future: date > today }));
  return { weeks, thisWeek, goal: g, thisWeekDone, days };
}
