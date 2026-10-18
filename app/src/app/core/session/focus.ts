/**
 * Modo foco do treino em curso: qual é o exercício em que estás agora. Só esse fica aberto; os outros ficam numa linha.
 * Só UI: não decide dose de treino.
 */

export interface FocusExercise {
  id: string;
  /** Séries de trabalho já registadas hoje. */
  workingSets: number;
  /** Séries alvo de hoje (com ciclo ou descarga já aplicados); 0 ou null = sem alvo. */
  targetSets: number | null;
}

/**
 * Um exercício está feito quando:
 * - tem alvo: chegou às séries alvo;
 * - não tem alvo (sessão livre): tem séries e já começaste um exercício a seguir.
 * `later` são os exercícios depois deste, pela ordem do treino.
 */
export function isFinished(ex: FocusExercise, later: readonly FocusExercise[]): boolean {
  if (ex.targetSets && ex.targetSets > 0) return ex.workingSets >= ex.targetSets;
  return ex.workingSets > 0 && later.some((e) => e.workingSets > 0);
}

/** O exercício atual: o primeiro, pela ordem do treino, que ainda não está feito. null quando está tudo feito. */
export function currentExerciseId(exercises: readonly FocusExercise[]): string | null {
  for (let i = 0; i < exercises.length; i++) {
    if (!isFinished(exercises[i], exercises.slice(i + 1))) return exercises[i].id;
  }
  return null;
}

/**
 * Qual fica aberto: o que escolheste (se ainda existe) ou o atual. Com tudo feito, o último, para continuar a registar.
 */
export function openExerciseId(exercises: readonly FocusExercise[], chosen: string | null): string | null {
  if (chosen && exercises.some((e) => e.id === chosen)) return chosen;
  return currentExerciseId(exercises) ?? exercises.at(-1)?.id ?? null;
}
