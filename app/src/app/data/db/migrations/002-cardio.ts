/**
 * 002 — tipo CARDIO.
 *
 * - exercise.kind aceita CARDIO. O SQLite não altera CHECKs, por isso a tabela é reconstruída
 *   (procedimento oficial: chaves estrangeiras desligadas, ver disableForeignKeys no migrator).
 * - Cardio mede-se por duração; distância e calorias são opcionais em cada série.
 * - set_log: distance_m e calories_kcal. planned_exercise e session_exercise: target_distance_m.
 */
const SYNC = `updated_at TEXT NOT NULL,
  deleted_at TEXT,
  device_id TEXT NOT NULL`;

export const MIGRATION_002 = `
CREATE TABLE exercise_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('STRENGTH','MOBILITY','CARDIO')),
  metric_type TEXT NOT NULL CHECK (metric_type IN ('WEIGHT_REPS','REPS','DURATION')),
  is_unilateral INTEGER NOT NULL DEFAULT 0 CHECK (is_unilateral IN (0,1)),
  region TEXT CHECK (region IN ('UPPER','LOWER','CORE','FULL_BODY')),
  movement_type TEXT CHECK (movement_type IN ('PUSH','PULL')),
  is_isometric INTEGER NOT NULL DEFAULT 0 CHECK (is_isometric IN (0,1)),
  equipment_id TEXT REFERENCES equipment(id),
  default_rest_seconds INTEGER CHECK (default_rest_seconds >= 0),
  notes TEXT,
  video_url TEXT,
  archived_at TEXT,
  ${SYNC},
  CHECK (NOT (kind = 'MOBILITY' AND metric_type = 'WEIGHT_REPS')),
  CHECK (kind <> 'CARDIO' OR metric_type = 'DURATION')
);
INSERT INTO exercise_new (id, name, kind, metric_type, is_unilateral, region, movement_type, is_isometric,
  equipment_id, default_rest_seconds, notes, video_url, archived_at, updated_at, deleted_at, device_id)
SELECT id, name, kind, metric_type, is_unilateral, region, movement_type, is_isometric,
  equipment_id, default_rest_seconds, notes, video_url, archived_at, updated_at, deleted_at, device_id
FROM exercise;
DROP TABLE exercise;
ALTER TABLE exercise_new RENAME TO exercise;
CREATE INDEX ix_exercise_name ON exercise(name);

ALTER TABLE set_log ADD COLUMN distance_m REAL CHECK (distance_m >= 0);
ALTER TABLE set_log ADD COLUMN calories_kcal REAL CHECK (calories_kcal >= 0);
ALTER TABLE planned_exercise ADD COLUMN target_distance_m REAL CHECK (target_distance_m >= 0);
ALTER TABLE session_exercise ADD COLUMN target_distance_m REAL;
`;
