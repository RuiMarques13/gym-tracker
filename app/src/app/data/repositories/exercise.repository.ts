import type { Exercise, ExerciseFilter, ExerciseInput } from '../models/exercise';

/** Contrato do repositório de exercícios (doc v2, secção 8). */
export interface ExerciseRepository {
  list(filter?: ExerciseFilter): Promise<Exercise[]>;
  get(id: string): Promise<Exercise | null>;
  /** Insere ou atualiza. Lança ExerciseValidationError se o nome ou a medida forem inválidos. */
  save(input: ExerciseInput): Promise<Exercise>;
  /** Soft delete que mantém o histórico. */
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  /** Só se nunca foi usado em treinos ou sessões; caso contrário lança erro (usar archive). */
  remove(id: string): Promise<void>;
  isUsed(id: string): Promise<boolean>;
}
