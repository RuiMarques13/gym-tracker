import type { Block, Kind, MetricType } from './enums';

export const BLOCK_ORDER: Block[] = ['WARMUP', 'MAIN'];

/** Linhas antigas com 'MOBILITY' (já não usado) passam para o bloco principal. */
export function normalizeBlock(raw: string): Block {
  return raw === 'WARMUP' ? 'WARMUP' : 'MAIN';
}

export const BLOCK_LABEL: Record<Block, string> = {
  WARMUP: 'Aquecimento',
  MAIN: 'Principal',
};

/** Um exercício dentro de um treino, com os alvos. */
export interface PlannedExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseKind: Kind;
  metricType: MetricType;
  isUnilateral: boolean;
  /** O exercício foi arquivado depois de entrar no treino. */
  exerciseArchived: boolean;
  position: number;
  block: Block;
  supersetGroup: string | null;
  targetSets: number | null;
  targetReps: number | null;
  targetDurationSeconds: number | null;
  targetWeightKg: number | null;
  targetDistanceM: number | null;
  restSeconds: number | null;
}

export interface Workout {
  id: string;
  name: string;
  notes: string | null;
  archivedAt: string | null;
  updatedAt: string;
  items: PlannedExercise[];
}

export interface WorkoutSummary {
  id: string;
  name: string;
  notes: string | null;
  archivedAt: string | null;
  updatedAt: string;
  exerciseCount: number;
  blockCounts: Record<Block, number>;
}

/** Item a guardar. A ordem no array (dentro de cada bloco) define a posição. */
export interface PlannedExerciseInput {
  id?: string;
  exerciseId: string;
  block: Block;
  targetSets?: number | null;
  targetReps?: number | null;
  targetDurationSeconds?: number | null;
  targetWeightKg?: number | null;
  targetDistanceM?: number | null;
  restSeconds?: number | null;
}

export interface WorkoutInput {
  id?: string;
  name: string;
  notes?: string | null;
  items: PlannedExerciseInput[];
}

export class WorkoutValidationError extends Error {
  constructor(
    readonly field: 'name' | 'items' | 'usage',
    message: string,
  ) {
    super(message);
    this.name = 'WorkoutValidationError';
  }
}

/** Alvos por defeito ao acrescentar um exercício a um treino. */
export function defaultTargets(kind: Kind, metric: MetricType): Omit<PlannedExerciseInput, 'exerciseId' | 'block'> {
  if (kind === 'CARDIO') return { targetSets: 1, targetDurationSeconds: 20 * 60 };
  if (kind === 'MOBILITY') {
    return metric === 'DURATION' ? { targetSets: 2, targetDurationSeconds: 30 } : { targetSets: 2, targetReps: 10 };
  }
  if (metric === 'DURATION') return { targetSets: 3, targetDurationSeconds: 30 };
  if (metric === 'REPS') return { targetSets: 3, targetReps: 12 };
  return { targetSets: 3, targetReps: 10 };
}

/** Bloco natural para um tipo de exercício. */
export function defaultBlock(kind: Kind): Block {
  return kind === 'STRENGTH' ? 'MAIN' : 'WARMUP';
}
