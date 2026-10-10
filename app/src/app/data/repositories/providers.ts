import { PhotoRepository, SqlitePhotoRepository } from './photo.repository';
import { inject, InjectionToken } from '@angular/core';
import { DatabaseService } from '../../core/db/database.service';
import { CLOCK } from '../../core/util/clock';
import { ExerciseRepository } from './exercise.repository';
import { LookupRepository, SqliteLookupRepository } from './lookup.repository';
import { SqliteExerciseRepository } from './sqlite/sqlite-exercise.repository';
import { BodyMetricRepository, SqliteBodyMetricRepository } from './body-metric.repository';
import { MetricsRepository, SqliteMetricsRepository } from './metrics.repository';
import { ScheduledRepository, SqliteScheduledRepository } from './scheduled.repository';
import { SessionRepository } from './session.repository';
import { SqliteSessionRepository } from './sqlite/sqlite-session.repository';
import { SqliteWorkoutRepository } from './sqlite/sqlite-workout.repository';
import { WorkoutRepository } from './workout.repository';

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
