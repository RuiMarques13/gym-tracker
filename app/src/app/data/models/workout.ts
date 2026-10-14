import type { Block, Kind, Mechanic, MetricType } from './enums';

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
  /** Faixa de repetições: mínimo (null = alvo único em `targetReps`). */
  targetRepsMin: number | null;
  /** Máximo da faixa, ou o alvo único. */
  targetReps: number | null;
  targetDurationSeconds: number | null;
  targetWeightKg: number | null;
  targetDistanceM: number | null;
  restSeconds: number | null;
  /** Do exercício (só leitura): para sugerir o descanso pelo tipo. */
  exerciseMechanic?: Mechanic | null;
  exerciseRestSeconds?: number | null;
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
  /** Exercícios seguidos com o mesmo grupo fazem superset (A, B…); a repo normaliza. */
  supersetGroup?: string | null;
  targetSets?: number | null;
  targetRepsMin?: number | null;
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
/** `range`: faixa de repetições do objetivo (core/progression/goals.ts), só nos exercícios de força com carga. */
export function defaultTargets(kind: Kind, metric: MetricType, range: [number, number] = [8, 12]): Omit<PlannedExerciseInput, 'exerciseId' | 'block'> {
  if (kind === 'CARDIO') return { targetSets: 1, targetDurationSeconds: 20 * 60 };
  if (kind === 'MOBILITY') {
    return metric === 'DURATION' ? { targetSets: 2, targetDurationSeconds: 30 } : { targetSets: 2, targetReps: 10 };
  }
  if (metric === 'DURATION') return { targetSets: 3, targetDurationSeconds: 30 };
  if (metric === 'REPS') return { targetSets: 3, targetRepsMin: 8, targetReps: 12 };
  return { targetSets: 3, targetRepsMin: range[0], targetReps: range[1] };
}

/** Bloco natural para um tipo de exercício. */
export function defaultBlock(kind: Kind): Block {
  return kind === 'STRENGTH' ? 'MAIN' : 'WARMUP';
}

/**
 * Supersets: só vale um grupo de 2 ou mais exercícios seguidos no mesmo bloco. Grupos partidos (por reordenar ou
 * remover) ou com um só exercício desfazem-se; os restantes são renomeados A, B, C… pela ordem.
 */
export function normalizeSupersets<T extends { block: string; supersetGroup?: string | null }>(items: T[]): T[] {
  const runs: number[][] = [];
  items.forEach((it, i) => {
    const prev = items[i - 1];
    const g = it.supersetGroup ?? null;
    if (g && prev && prev.block === it.block && (prev.supersetGroup ?? null) === g) runs[runs.length - 1].push(i);
    else runs.push([i]);
  });
  const label = new Map<number, string>();
  let n = 0;
  for (const r of runs) {
    if (r.length < 2 || !items[r[0]].supersetGroup) continue;
    const name = String.fromCharCode(65 + (n++ % 26));
    for (const i of r) label.set(i, name);
  }
  return items.map((it, i) => ({ ...it, supersetGroup: label.get(i) ?? null }));
}
