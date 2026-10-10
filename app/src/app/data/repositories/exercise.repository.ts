import type { Exercise, ExerciseFilter } from '../models/exercise';

/**
 * Contrato do repositório de exercícios (doc v2, secção 8).
 * Fase 0: leitura (list/get). Fase 1.1: save, archive, restore, remove.
 */
export interface ExerciseRepository {
  list(filter?: ExerciseFilter): Promise<Exercise[]>;
  get(id: string): Promise<Exercise | null>;
}
