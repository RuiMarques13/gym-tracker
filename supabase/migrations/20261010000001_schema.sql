-- Gym Tracker — esquema do servidor (Fase 2).
--
-- Espelha o esquema SQLite da app (migrações 001 e 002) com duas diferenças:
--   * cada tabela tem user_id e server_version (cursor de sync);
--   * a chave primária é (user_id, id): os IDs do seed são UUID v5 iguais para todos os
--     utilizadores, por isso o id sozinho não é único no servidor.
-- Datas: updated_at é timestamptz (comparação e limite pelo relógio do servidor); os restantes
-- campos de data/hora são texto ISO 8601, tal como vêm da app (opacos para o servidor).
-- SQL portável: sem extensões nem funções exclusivas do Supabase (o mesmo ficheiro serve para Flyway).

-- ---------------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------------

-- Cursor de sync: um número crescente único, atribuído em cada escrita aceite.
CREATE SEQUENCE sync_version_seq AS bigint;

-- Utilizador autenticado. Lê o JWT que o PostgREST/Supabase coloca na sessão
-- (request.jwt.claims, ou o formato antigo request.jwt.claim.sub). Um backend próprio
-- só precisa de definir um destes valores antes de cada pedido.
CREATE FUNCTION current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid
$$;

-- Data/hora no mesmo formato que a app gera (toISOString): 2026-10-10T12:00:00.123Z
CREATE FUNCTION iso_ts(ts timestamptz) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

-- ---------------------------------------------------------------------------
-- Tabelas (ordem de dependência)
-- ---------------------------------------------------------------------------

CREATE TABLE equipment (
  user_id uuid NOT NULL,
  id uuid NOT NULL,
  name text NOT NULL,
  updated_at timestamptz NOT NULL,
  deleted_at text,
  device_id text NOT NULL,
  server_version bigint NOT NULL DEFAULT nextval('sync_version_seq'),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE muscle_group (
  user_id uuid NOT NULL,
  id uuid NOT NULL,
  name text NOT NULL,
  region text CHECK (region IN ('UPPER','LOWER','CORE','FULL_BODY')),
  updated_at timestamptz NOT NULL,
  deleted_at text,
  device_id text NOT NULL,
  server_version bigint NOT NULL DEFAULT nextval('sync_version_seq'),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE mobility_area (
  user_id uuid NOT NULL,
  id uuid NOT NULL,
  name text NOT NULL,
  updated_at timestamptz NOT NULL,
  deleted_at text,
  device_id text NOT NULL,
  server_version bigint NOT NULL DEFAULT nextval('sync_version_seq'),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE exercise (
  user_id uuid NOT NULL,
  id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('STRENGTH','MOBILITY','CARDIO')),
  metric_type text NOT NULL CHECK (metric_type IN ('WEIGHT_REPS','REPS','DURATION')),
  is_unilateral smallint NOT NULL DEFAULT 0 CHECK (is_unilateral IN (0,1)),
  region text CHECK (region IN ('UPPER','LOWER','CORE','FULL_BODY')),
  movement_type text CHECK (movement_type IN ('PUSH','PULL')),
  is_isometric smallint NOT NULL DEFAULT 0 CHECK (is_isometric IN (0,1)),
  equipment_id uuid,
  default_rest_seconds integer CHECK (default_rest_seconds >= 0),
  notes text,
  video_url text,
  archived_at text,
  updated_at timestamptz NOT NULL,
  deleted_at text,
  device_id text NOT NULL,
  server_version bigint NOT NULL DEFAULT nextval('sync_version_seq'),
  PRIMARY KEY (user_id, id),
  CHECK (NOT (kind = 'MOBILITY' AND metric_type = 'WEIGHT_REPS')),
  CHECK (kind <> 'CARDIO' OR metric_type = 'DURATION'),
  FOREIGN KEY (user_id, equipment_id) REFERENCES equipment (user_id, id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE exercise_muscle (
  user_id uuid NOT NULL,
  id uuid NOT NULL,
  exercise_id uuid NOT NULL,
  muscle_group_id uuid NOT NULL,
  is_primary smallint NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  updated_at timestamptz NOT NULL,
  deleted_at text,
  device_id text NOT NULL,
  server_version bigint NOT NULL DEFAULT nextval('sync_version_seq'),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, exercise_id) REFERENCES exercise (user_id, id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (user_id, muscle_group_id) REFERENCES muscle_group (user_id, id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE exercise_mobility_area (
  user_id uuid NOT NULL,
  id uuid NOT NULL,
  exercise_id uuid NOT NULL,
  mobility_area_id uuid NOT NULL,
  updated_at timestamptz NOT NULL,
  deleted_at text,
  device_id text NOT NULL,
  server_version bigint NOT NULL DEFAULT nextval('sync_version_seq'),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, exercise_id) REFERENCES exercise (user_id, id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (user_id, mobility_area_id) REFERENCES mobility_area (user_id, id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE workout_template (
  user_id uuid NOT NULL,
  id uuid NOT NULL,
  name text NOT NULL,
  notes text,
  archived_at text,
  updated_at timestamptz NOT NULL,
  deleted_at text,
  device_id text NOT NULL,
  server_version bigint NOT NULL DEFAULT nextval('sync_version_seq'),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE planned_exercise (
  user_id uuid NOT NULL,
  id uuid NOT NULL,
  template_id uuid NOT NULL,
  exercise_id uuid NOT NULL,
  position integer NOT NULL,
  block text NOT NULL DEFAULT 'MAIN' CHECK (block IN ('WARMUP','MAIN','MOBILITY')),
  superset_group text,
  target_sets integer CHECK (target_sets >= 0),
  target_reps integer CHECK (target_reps >= 0),
  target_duration_seconds integer CHECK (target_duration_seconds >= 0),
  target_weight_kg double precision CHECK (target_weight_kg >= 0),
  rest_seconds integer CHECK (rest_seconds >= 0),
  target_distance_m double precision CHECK (target_distance_m >= 0),
  updated_at timestamptz NOT NULL,
  deleted_at text,
  device_id text NOT NULL,
  server_version bigint NOT NULL DEFAULT nextval('sync_version_seq'),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, template_id) REFERENCES workout_template (user_id, id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (user_id, exercise_id) REFERENCES exercise (user_id, id) DEFERRABLE INITIALLY DEFERRED
);

-- date é uma data local (YYYY-MM-DD), guardada como texto.
CREATE TABLE scheduled_workout (
  user_id uuid NOT NULL,
  id uuid NOT NULL,
  date text NOT NULL,
  template_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','DONE','SKIPPED')),
  updated_at timestamptz NOT NULL,
  deleted_at text,
  device_id text NOT NULL,
  server_version bigint NOT NULL DEFAULT nextval('sync_version_seq'),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, template_id) REFERENCES workout_template (user_id, id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE session (
  user_id uuid NOT NULL,
  id uuid NOT NULL,
  template_id uuid,
  scheduled_id uuid,
  started_at text NOT NULL,
  ended_at text,
  paused_seconds integer NOT NULL DEFAULT 0 CHECK (paused_seconds >= 0),
  rpe double precision CHECK (rpe BETWEEN 0 AND 10),
  notes text,
  updated_at timestamptz NOT NULL,
  deleted_at text,
  device_id text NOT NULL,
  server_version bigint NOT NULL DEFAULT nextval('sync_version_seq'),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, template_id) REFERENCES workout_template (user_id, id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (user_id, scheduled_id) REFERENCES scheduled_workout (user_id, id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE session_exercise (
  user_id uuid NOT NULL,
  id uuid NOT NULL,
  session_id uuid NOT NULL,
  exercise_id uuid NOT NULL,
  position integer NOT NULL,
  block text NOT NULL DEFAULT 'MAIN' CHECK (block IN ('WARMUP','MAIN','MOBILITY')),
  superset_group text,
  metric_type text NOT NULL CHECK (metric_type IN ('WEIGHT_REPS','REPS','DURATION')),
  is_unilateral smallint NOT NULL DEFAULT 0 CHECK (is_unilateral IN (0,1)),
  target_sets integer,
  target_reps integer,
  target_duration_seconds integer,
  target_weight_kg double precision,
  rest_seconds integer,
  notes text,
  target_distance_m double precision,
  updated_at timestamptz NOT NULL,
  deleted_at text,
  device_id text NOT NULL,
  server_version bigint NOT NULL DEFAULT nextval('sync_version_seq'),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, session_id) REFERENCES session (user_id, id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (user_id, exercise_id) REFERENCES exercise (user_id, id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE set_log (
  user_id uuid NOT NULL,
  id uuid NOT NULL,
  session_exercise_id uuid NOT NULL,
  position integer NOT NULL,
  type text NOT NULL DEFAULT 'WORKING' CHECK (type IN ('WARMUP','WORKING')),
  side text NOT NULL DEFAULT 'BOTH' CHECK (side IN ('BOTH','LEFT','RIGHT')),
  weight_kg double precision CHECK (weight_kg >= 0),
  reps integer CHECK (reps >= 0),
  duration_seconds integer CHECK (duration_seconds >= 0),
  rpe double precision CHECK (rpe BETWEEN 0 AND 10),
  rom_score integer CHECK (rom_score BETWEEN 1 AND 5),
  rest_seconds_actual integer CHECK (rest_seconds_actual >= 0),
  completed_at text,
  distance_m double precision CHECK (distance_m >= 0),
  calories_kcal double precision CHECK (calories_kcal >= 0),
  updated_at timestamptz NOT NULL,
  deleted_at text,
  device_id text NOT NULL,
  server_version bigint NOT NULL DEFAULT nextval('sync_version_seq'),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, session_exercise_id) REFERENCES session_exercise (user_id, id) DEFERRABLE INITIALLY DEFERRED
);

-- Só scope ACCOUNT e LAYOUT sincronizam; o servidor recusa DEVICE.
CREATE TABLE setting (
  user_id uuid NOT NULL,
  id uuid NOT NULL,
  key text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('ACCOUNT','LAYOUT')),
  scope_ref text,
  value text NOT NULL,
  updated_at timestamptz NOT NULL,
  deleted_at text,
  device_id text NOT NULL,
  server_version bigint NOT NULL DEFAULT nextval('sync_version_seq'),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE body_metric (
  user_id uuid NOT NULL,
  id uuid NOT NULL,
  date text NOT NULL,
  type text NOT NULL,
  value double precision NOT NULL,
  updated_at timestamptz NOT NULL,
  deleted_at text,
  device_id text NOT NULL,
  server_version bigint NOT NULL DEFAULT nextval('sync_version_seq'),
  PRIMARY KEY (user_id, id)
);

-- Índices de cursor: o pull lê por (user_id, server_version).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['equipment','muscle_group','mobility_area','exercise','exercise_muscle',
    'exercise_mobility_area','workout_template','planned_exercise','scheduled_workout','session',
    'session_exercise','set_log','setting','body_metric']
  LOOP
    EXECUTE format('CREATE INDEX %I ON %I (user_id, server_version)', 'ix_' || t || '_cursor', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Segurança: RLS ativa em todas as tabelas, desde o primeiro dia.
-- A app nunca lê nem escreve tabelas diretamente (só as funções sync_*), por isso os papéis
-- de API não recebem privilégios de tabela. A política é uma segunda barreira.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['equipment','muscle_group','mobility_area','exercise','exercise_muscle',
    'exercise_mobility_area','workout_template','planned_exercise','scheduled_workout','session',
    'session_exercise','set_log','setting','body_metric']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON %I FROM PUBLIC', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id())',
      t || '_owner', t);
  END LOOP;
END $$;
