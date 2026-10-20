/**
 * Progresso do treino em curso: a barra do topo e as bolinhas de cada exercício. Só contagens, sem regras de treino.
 */

export interface ExerciseProgress {
  /** Séries de trabalho já registadas. */
  workingSets: number;
  /** Séries alvo de hoje (ciclo e descarga já aplicados); null = sem alvo. */
  targetSets: number | null;
}

export interface WorkoutProgress {
  done: number;
  /** Séries previstas no treino; null quando nenhum exercício tem alvo (sessão livre). */
  total: number | null;
}

/**
 * Séries feitas e previstas. Um exercício com alvo conta o maior entre o alvo e o que já fizeste (séries a mais
 * não fazem a barra passar de 100%); um exercício sem alvo conta só o que fizeste.
 */
export function workoutProgress(list: readonly ExerciseProgress[]): WorkoutProgress {
  const done = list.reduce((n, e) => n + e.workingSets, 0);
  if (!list.some((e) => e.targetSets)) return { done, total: null };
  const total = list.reduce((n, e) => n + Math.max(e.targetSets ?? 0, e.workingSets), 0);
  return { done, total };
}

export type DotState = 'done' | 'next' | 'todo';

/** Máximo de bolinhas por exercício (mais do que isto deixa de caber numa linha). */
export const MAX_DOTS = 10;

/** Bolinhas de um exercício: feitas, a seguinte e as que faltam. Sem alvo não há bolinhas. */
export function setDots(workingSets: number, targetSets: number | null): DotState[] {
  if (!targetSets) return [];
  const n = Math.min(MAX_DOTS, Math.max(targetSets, workingSets));
  return Array.from({ length: n }, (_, i) => (i < workingSets ? 'done' : i === workingSets ? 'next' : 'todo'));
}
