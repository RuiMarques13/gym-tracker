import { CycleRepository, SqliteCycleRepository } from '../data/repositories/cycle.repository';
import { SqliteSuggestionRepository, SuggestionRepository } from '../data/repositories/suggestion.repository';
import { RecoveryRepository, SqliteRecoveryRepository } from '../data/repositories/recovery.repository';
import { PhotoRepository, SqlitePhotoRepository } from '../data/repositories/photo.repository';
import { inject, InjectionToken } from '@angular/core';
import { DatabaseService } from './db/database.service';
import { CLOCK } from './clock';
import { ExerciseRepository } from '../data/repositories/exercise.repository';
import { LookupRepository, SqliteLookupRepository } from '../data/repositories/lookup.repository';
import { SqliteExerciseRepository } from '../data/repositories/sqlite/sqlite-exercise.repository';
import { BodyMetricRepository, SqliteBodyMetricRepository } from '../data/repositories/body-metric.repository';
import { MetricsRepository, SqliteMetricsRepository } from '../data/repositories/metrics.repository';
import { ScheduledRepository, SqliteScheduledRepository } from '../data/repositories/scheduled.repository';
import { SessionRepository } from '../data/repositories/session.repository';
import { SqliteSessionRepository } from '../data/repositories/sqlite/sqlite-session.repository';
import { SqliteWorkoutRepository } from '../data/repositories/sqlite/sqlite-workout.repository';
import { WorkoutRepository } from '../data/repositories/workout.repository';

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
  factory: () => {
    const database = inject(DatabaseService);
    return new SqliteLookupRepository(database.db, inject(CLOCK), database.deviceId);
  },
});

export const WORKOUT_REPOSITORY = new InjectionToken<WorkoutRepository>('WorkoutRepository', {
  providedIn: 'root',
  factory: () => {
    const database = inject(DatabaseService);
    return new SqliteWorkoutRepository(database.db, inject(CLOCK), database.deviceId);
  },
});

export const SESSION_REPOSITORY = new InjectionToken<SessionRepository>('SessionRepository', {
  providedIn: 'root',
  factory: () => {
    const database = inject(DatabaseService);
    return new SqliteSessionRepository(database.db, inject(CLOCK), database.deviceId);
  },
});

export const METRICS_REPOSITORY = new InjectionToken<MetricsRepository>('MetricsRepository', {
  providedIn: 'root',
  factory: () => new SqliteMetricsRepository(inject(DatabaseService).db),
});

export const SCHEDULED_REPOSITORY = new InjectionToken<ScheduledRepository>('ScheduledRepository', {
  providedIn: 'root',
  factory: () => {
    const database = inject(DatabaseService);
    return new SqliteScheduledRepository(database.db, inject(CLOCK), database.deviceId);
  },
});

export const BODY_METRIC_REPOSITORY = new InjectionToken<BodyMetricRepository>('BodyMetricRepository', {
  providedIn: 'root',
  factory: () => {
    const database = inject(DatabaseService);
    return new SqliteBodyMetricRepository(database.db, inject(CLOCK), database.deviceId);
  },
});

export const PHOTO_REPOSITORY = new InjectionToken<PhotoRepository>('PhotoRepository', {
  providedIn: 'root',
  factory: () => {
    const database = inject(DatabaseService);
    return new SqlitePhotoRepository(database.db, inject(CLOCK), database.deviceId);
  },
});

export const RECOVERY_REPOSITORY = new InjectionToken<RecoveryRepository>('RecoveryRepository', {
  providedIn: 'root',
  factory: () => {
    const database = inject(DatabaseService);
    return new SqliteRecoveryRepository(database.db, inject(CLOCK), database.deviceId);
  },
});

export const SUGGESTION_REPOSITORY = new InjectionToken<SuggestionRepository>('SuggestionRepository', {
  providedIn: 'root',
  factory: () => {
    const database = inject(DatabaseService);
    return new SqliteSuggestionRepository(database.db, inject(CLOCK), database.deviceId);
  },
});

export const CYCLE_REPOSITORY = new InjectionToken<CycleRepository>('CycleRepository', {
  providedIn: 'root',
  factory: () => {
    const database = inject(DatabaseService);
    return new SqliteCycleRepository(database.db, inject(CLOCK), database.deviceId);
  },
});
