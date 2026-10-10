import type { Kind, MetricType, MovementType, Region } from '../../data/models/enums';

/**
 * Formato do seed gerado por tools/import-excel/build-seed.mjs.
 * Só tem chaves e nomes; os IDs são calculados na app com ids.* (UUID v5),
 * para haver uma única fonte de verdade para o namespace.
 */
export interface SeedData {
  version: number;
  equipment: { key: string; name: string }[];
  muscles: { key: string; name: string; region: Region | null }[];
  mobilityAreas: { key: string; name: string }[];
  exercises: SeedExercise[];
}

export interface SeedExercise {
  name: string;
  kind: Kind;
  metricType: MetricType;
  isUnilateral: boolean;
  isIsometric: boolean;
  region: Region | null;
  movementType: MovementType | null;
  equipment: string | null;
  defaultRestSeconds: number | null;
  primary: string[];
  secondary: string[];
  mobilityAreas: string[];
}
