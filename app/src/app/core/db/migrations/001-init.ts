/**
 * 001 — esquema inicial (doc v2, secção 6).
 *
 * Regras:
 * - Todas as tabelas sincronizáveis têm id (UUID), updated_at, deleted_at, device_id.
 * - Datas em ISO 8601 UTC. scheduled_workout.date e body_metric.date são datas locais (YYYY-MM-DD).
 * - Não há índices UNIQUE em nomes: duas linhas com o mesmo nome criadas em
 *   dispositivos diferentes fariam o sync falhar. A unicidade valida-se nos repositórios.
 * - local_meta e schema_migrations são só locais e nunca sincronizam.
 */
const SYNC = `updated_at TEXT NOT NULL,
  deleted_at TEXT,
  device_id TEXT NOT NULL`;

export const MIGRATION_001 = `
CREATE TABLE local_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE equipment (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ${SYNC}
);

CREATE TABLE muscle_group (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT CHECK (region IN ('UPPER','LOWER','CORE','FULL_BODY')),
  ${SYNC}
);

CREATE TABLE mobility_area (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ${SYNC}
);

CREATE TABLE exercise (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('STRENGTH','MOBILITY')),
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
  CHECK (NOT (kind = 'MOBILITY' AND metric_type = 'WEIGHT_REPS'))
);
CREATE INDEX ix_exercise_name ON exercise(name);

CREATE TABLE exercise_muscle (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES exercise(id),
  muscle_group_id TEXT NOT NULL REFERENCES muscle_group(id),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  ${SYNC}
);
CREATE INDEX ix_exercise_muscle_exercise ON exercise_muscle(exercise_id);
CREATE INDEX ix_exercise_muscle_muscle ON exercise_muscle(muscle_group_id);

CREATE TABLE exercise_mobility_area (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES exercise(id),
  mobility_area_id TEXT NOT NULL REFERENCES mobility_area(id),
  ${SYNC}
);
CREATE INDEX ix_exercise_mobility_area_exercise ON exercise_mobility_area(exercise_id);
CREATE INDEX ix_exercise_mobility_area_area ON exercise_mobility_area(mobility_area_id);

CREATE TABLE workout_template (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  notes TEXT,
  archived_at TEXT,
  ${SYNC}
);

CREATE TABLE planned_exercise (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES workout_template(id),
  exercise_id TEXT NOT NULL REFERENCES exercise(id),
  position INTEGER NOT NULL,
  block TEXT NOT NULL DEFAULT 'MAIN' CHECK (block IN ('WARMUP','MAIN','MOBILITY')),
  superset_group TEXT,
  target_sets INTEGER CHECK (target_sets >= 0),
  target_reps INTEGER CHECK (target_reps >= 0),
  target_duration_seconds INTEGER CHECK (target_duration_seconds >= 0),
  target_weight_kg REAL CHECK (target_weight_kg >= 0),
  rest_seconds INTEGER CHECK (rest_seconds >= 0),
  ${SYNC}
);
CREATE INDEX ix_planned_exercise_template ON planned_exercise(template_id, position);

CREATE TABLE scheduled_workout (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  template_id TEXT NOT NULL REFERENCES workout_template(id),
  status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','DONE','SKIPPED')),
  ${SYNC}
);
CREATE INDEX ix_scheduled_workout_date ON scheduled_workout(date);

CREATE TABLE session (
  id TEXT PRIMARY KEY,
  template_id TEXT REFERENCES workout_template(id),
  scheduled_id TEXT REFERENCES scheduled_workout(id),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  paused_seconds INTEGER NOT NULL DEFAULT 0 CHECK (paused_seconds >= 0),
  rpe REAL CHECK (rpe BETWEEN 0 AND 10),
  notes TEXT,
  ${SYNC}
);
CREATE INDEX ix_session_started ON session(started_at);

-- Snapshot dos alvos do template e da forma de medir o exercício no momento da sessão.
CREATE TABLE session_exercise (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES session(id),
  exercise_id TEXT NOT NULL REFERENCES exercise(id),
  position INTEGER NOT NULL,
  block TEXT NOT NULL DEFAULT 'MAIN' CHECK (block IN ('WARMUP','MAIN','MOBILITY')),
  superset_group TEXT,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('WEIGHT_REPS','REPS','DURATION')),
  is_unilateral INTEGER NOT NULL DEFAULT 0 CHECK (is_unilateral IN (0,1)),
  target_sets INTEGER,
  target_reps INTEGER,
  target_duration_seconds INTEGER,
  target_weight_kg REAL,
  rest_seconds INTEGER,
  notes TEXT,
  ${SYNC}
);
CREATE INDEX ix_session_exercise_session ON session_exercise(session_id, position);
CREATE INDEX ix_session_exercise_exercise ON session_exercise(exercise_id);

-- LEFT e RIGHT da mesma série partilham position e contam como uma série.
CREATE TABLE set_log (
  id TEXT PRIMARY KEY,
  session_exercise_id TEXT NOT NULL REFERENCES session_exercise(id),
  position INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'WORKING' CHECK (type IN ('WARMUP','WORKING')),
  side TEXT NOT NULL DEFAULT 'BOTH' CHECK (side IN ('BOTH','LEFT','RIGHT')),
  weight_kg REAL CHECK (weight_kg >= 0),
  reps INTEGER CHECK (reps >= 0),
  duration_seconds INTEGER CHECK (duration_seconds >= 0),
  rpe REAL CHECK (rpe BETWEEN 0 AND 10),
  rom_score INTEGER CHECK (rom_score BETWEEN 1 AND 5),
  rest_seconds_actual INTEGER CHECK (rest_seconds_actual >= 0),
  completed_at TEXT,
  ${SYNC}
);
CREATE INDEX ix_set_log_session_exercise ON set_log(session_exercise_id, position);

-- scope: ACCOUNT (sincroniza), DEVICE (scope_ref = device_id, não sincroniza), LAYOUT (scope_ref = formato de ecrã).
-- value: JSON {"v": versão do esquema, "value": ...}. id = UUID v5 de scope:scope_ref:key.
CREATE TABLE setting (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('ACCOUNT','DEVICE','LAYOUT')),
  scope_ref TEXT,
  value TEXT NOT NULL,
  ${SYNC}
);
CREATE INDEX ix_setting_key ON setting(scope, scope_ref, key);

CREATE TABLE body_metric (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  value REAL NOT NULL,
  ${SYNC}
);
CREATE INDEX ix_body_metric_type_date ON body_metric(type, date);
`;
