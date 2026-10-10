import { inject, InjectionToken } from '@angular/core';
import { DatabaseService } from '../../core/db/database.service';
import { CLOCK } from '../../core/util/clock';
import { ExerciseRepository } from './exercise.repository';
import { LookupRepository, SqliteLookupRepository } from './lookup.repository';
import { SqliteExerciseRepository } from './sqlite/sqlite-exercise.repository';

/**
 * Os ecrãs injetam interfaces, nunca a implementação SQLite.
 * Trocar a fonte de dados é mudar só esta fábrica.
 */
export const EXERCISE_REPOSITORY = new InjectionToken<ExerciseRepository>('ExerciseRepository', {
  providedIn: 'root',
  factory: () => {
    const database = inject(DatabaseService);
    return new SqliteExerciseRepository(database.db, inject(CLOCK), database.deviceId);
  },
});

export const LOOKUP_REPOSITORY = new InjectionToken<LookupRepository>('LookupRepository', {
  providedIn: 'root',
  factory: () => new SqliteLookupRepository(inject(DatabaseService).db),
});
