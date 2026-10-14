-- Histórico das sugestões de progressão (aceites ou recusadas). Corre depois dos ficheiros 1 a 7.
-- Seguro correr mais de uma vez.
CREATE TABLE IF NOT EXISTS suggestion (
  user_id uuid NOT NULL,
  id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('STAGNATION','FATIGUE')),
  exercise_id uuid,
  episode text NOT NULL,
  response text CHECK (response IN ('deload','volume','range','swap')),
  status text NOT NULL CHECK (status IN ('ACCEPTED','DECLINED')),
  payload text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  deleted_at text,
  device_id text NOT NULL,
  server_version bigint NOT NULL DEFAULT nextval('sync_version_seq'),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS ix_suggestion_cursor ON suggestion (user_id, server_version);
ALTER TABLE suggestion ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON suggestion FROM PUBLIC;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suggestion' AND policyname = 'suggestion_owner') THEN
    CREATE POLICY suggestion_owner ON suggestion
      USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION sync_tables() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['equipment','muscle_group','mobility_area','exercise','exercise_muscle',
    'exercise_mobility_area','workout_template','planned_exercise','scheduled_workout','session',
    'session_exercise','set_log','setting','body_metric','progress_photo','muscle_recovery','suggestion']
$$;
