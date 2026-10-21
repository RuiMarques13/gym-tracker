-- Formato dos grupos de exercícios (superset, circuito, Tabata, EMOM, AMRAP, intervalos), num treino ou numa sessão.
-- Corre depois dos ficheiros anteriores. Seguro correr mais de uma vez.
CREATE TABLE IF NOT EXISTS exercise_group (
  user_id uuid NOT NULL,
  id uuid NOT NULL,
  template_id uuid,
  session_id uuid,
  group_key text NOT NULL,
  kind text NOT NULL,
  rounds integer,
  round_rest_seconds integer,
  work_seconds integer,
  rest_seconds integer,
  duration_seconds integer,
  result_rounds integer,
  result_reps integer,
  result_seconds integer,
  updated_at timestamptz NOT NULL,
  deleted_at text,
  device_id text NOT NULL,
  server_version bigint NOT NULL DEFAULT nextval('sync_version_seq'),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS ix_exercise_group_cursor ON exercise_group (user_id, server_version);
ALTER TABLE exercise_group ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON exercise_group FROM PUBLIC;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'exercise_group' AND policyname = 'exercise_group_owner') THEN
    CREATE POLICY exercise_group_owner ON exercise_group
      USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION sync_tables() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['equipment','muscle_group','mobility_area','exercise','exercise_muscle',
    'exercise_mobility_area','workout_template','planned_exercise','scheduled_workout','session',
    'session_exercise','set_log','setting','body_metric','progress_photo','muscle_recovery','suggestion','training_cycle',
    'exercise_group']
$$;
