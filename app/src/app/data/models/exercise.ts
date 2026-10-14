import type { Category, Kind, Mechanic, MetricType, MovementType, Region } from './enums';

export interface Exercise {
  id: string;
  name: string;
  kind: Kind;
  category: Category;
  metricType: MetricType;
  isUnilateral: boolean;
  isIsometric: boolean;
  region: Region | null;
  movementType: MovementType | null;
  equipmentId: string | null;
  equipmentName: string | null;
  defaultRestSeconds: number | null;
  /** Multiarticular ou monoarticular (decide quanto subir a carga); null = não indicado. */
  mechanic: Mechanic | null;
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
  category?: Category;
  muscleGroupIds?: string[];
  mobilityAreaIds?: string[];
  region?: Region;
  movementType?: MovementType;
  isometric?: boolean;
  unilateral?: boolean;
  equipmentIds?: string[];
  includeArchived?: boolean;
  /** name (A→Z, por defeito) ou recent (alterados mais recentemente primeiro). */
  sort?: 'name' | 'recent';
}

/** Dados para criar ou editar. Sem id = novo (UUID v4); com id = atualiza ou cria com esse id. */
export interface ExerciseInput {
  id?: string;
  name: string;
  kind: Kind;
  /** Se vazia, usa a categoria por omissão do `kind`. Tem de pertencer ao `kind`. */
  category?: Category | null;
  metricType: MetricType;
  isUnilateral?: boolean;
  isIsometric?: boolean;
  region?: Region | null;
  movementType?: MovementType | null;
  equipmentId?: string | null;
  defaultRestSeconds?: number | null;
  mechanic?: Mechanic | null;
  notes?: string | null;
  videoUrl?: string | null;
  primaryMuscleIds?: string[];
  secondaryMuscleIds?: string[];
  mobilityAreaIds?: string[];
}

export class ExerciseValidationError extends Error {
  constructor(
    readonly field: 'name' | 'metricType' | 'category' | 'usage',
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
