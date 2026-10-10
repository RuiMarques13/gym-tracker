import type { Workout, WorkoutInput, WorkoutSummary } from '../models/workout';

/** Contrato do repositório de treinos (templates). Doc v2, secções 3.3 e 8. */
export interface WorkoutRepository {
  list(options?: { includeArchived?: boolean }): Promise<WorkoutSummary[]>;
  get(id: string): Promise<Workout | null>;
  /** Insere ou atualiza o treino e acerta os itens (novos, alterados, removidos). */
  save(input: WorkoutInput): Promise<Workout>;
  /** Cópia profunda com nome «X (cópia)». */
  copy(id: string): Promise<Workout>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  /** Só se nunca houve sessões com este treino; caso contrário usar archive. */
  remove(id: string): Promise<void>;
  isUsed(id: string): Promise<boolean>;
}
