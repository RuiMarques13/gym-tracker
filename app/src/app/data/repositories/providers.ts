import { inject, InjectionToken } from '@angular/core';
import { DatabaseService } from '../../core/db/database.service';
import { ExerciseRepository } from './exercise.repository';
import { SqliteExerciseRepository } from './sqlite/sqlite-exercise.repository';

/**
 * Os ecrãs injetam interfaces, nunca a implementação SQLite.
 * Trocar a fonte de dados é mudar só esta fábrica.
 */
export const EXERCISE_REPOSITORY = new InjectionToken<ExerciseRepository>('ExerciseRepository', {
  providedIn: 'root',
  factory: () => new SqliteExerciseRepository(inject(DatabaseService).db),
});
