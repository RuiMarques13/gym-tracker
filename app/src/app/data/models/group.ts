export type GroupKind = 'SUPERSET' | 'CIRCUIT' | 'TABATA' | 'EMOM' | 'AMRAP' | 'INTERVALS';

export interface GroupConfig {
  kind: GroupKind;
  /** Voltas (circuito) ou rondas (Tabata, EMOM, intervalos). null no superset e no AMRAP. */
  rounds: number | null;
  /** Descanso entre voltas (s), só no circuito; null = o descanso do exercício. */
  roundRestSeconds: number | null;
  /** Trabalho por ronda (s): Tabata e intervalos; no EMOM é o minuto (60). */
  workSeconds: number | null;
  /** Descanso por ronda (s): Tabata e intervalos. */
  restSeconds: number | null;
  /** Duração total (s): só AMRAP. */
  durationSeconds: number | null;
}



/** Formato de um grupo de exercícios num treino ou numa sessão (tabela exercise_group). */
export interface ExerciseGroup extends GroupConfig {
  id: string;
  templateId: string | null;
  sessionId: string | null;
  /** A letra do grupo (superset_group dos exercícios). */
  groupKey: string;
  /** Resultado de um formato por tempo nesta sessão. */
  resultRounds: number | null;
  resultReps: number | null;
  resultSeconds: number | null;
}

export interface GroupResult {
  rounds: number | null;
  reps: number | null;
  seconds: number | null;
}
