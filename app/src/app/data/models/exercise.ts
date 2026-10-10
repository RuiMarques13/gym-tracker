import type { Kind, MetricType, MovementType, Region } from './enums';

export interface Exercise {
  id: string;
  name: string;
  kind: Kind;
  metricType: MetricType;
  isUnilateral: boolean;
  isIsometric: boolean;
  region: Region | null;
  movementType: MovementType | null;
  equipmentId: string | null;
  equipmentName: string | null;
  defaultRestSeconds: number | null;
  notes: string | null;
  videoUrl: string | null;
  archivedAt: string | null;
  updatedAt: string;
  primaryMuscleIds: string[];
  secondaryMuscleIds: string[];
  mobilityAreaIds: string[];
}

export interface ExerciseFilter {
  q?: string;
  kind?: Kind;
  muscleGroupIds?: string[];
  mobilityAreaIds?: string[];
  region?: Region;
  movementType?: MovementType;
  isometric?: boolean;
  unilateral?: boolean;
  equipmentIds?: string[];
  includeArchived?: boolean;
}

/** Dados para criar ou editar. Sem id = novo (UUID v4); com id = atualiza ou cria com esse id. */
export interface ExerciseInput {
  id?: string;
  name: string;
  kind: Kind;
  metricType: MetricType;
  isUnilateral?: boolean;
  isIsometric?: boolean;
  region?: Region | null;
  movementType?: MovementType | null;
  equipmentId?: string | null;
  defaultRestSeconds?: number | null;
  notes?: string | null;
  videoUrl?: string | null;
  primaryMuscleIds?: string[];
  secondaryMuscleIds?: string[];
  mobilityAreaIds?: string[];
}

export class ExerciseValidationError extends Error {
  constructor(
    readonly field: 'name' | 'metricType' | 'usage',
    message: string,
  ) {
    super(message);
    this.name = 'ExerciseValidationError';
  }
}

export interface LookupItem {
  id: string;
  name: string;
}
