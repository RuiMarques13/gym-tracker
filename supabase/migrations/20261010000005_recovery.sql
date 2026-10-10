-- Recuperação percebida por músculo (1 sem dor … 5 muito dorido). Corre depois dos ficheiros 1 a 4.
CREATE TABLE IF NOT EXISTS muscle_recovery (
  user_id uuid NOT NULL,
  id uuid NOT NULL,
  date text NOT NULL,
  muscle text NOT NULL,
  soreness integer NOT NULL CHECK (soreness BETWEEN 1 AND 5),
  updated_at timestamptz NOT NULL,
  deleted_at text,
  device_id text NOT NULL,
  server_version bigint NOT NULL DEFAULT nextval('sync_version_seq'),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS ix_muscle_recovery_cursor ON muscle_recovery (user_id, server_version);
ALTER TABLE muscle_recovery ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON muscle_recovery FROM PUBLIC;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'muscle_recovery' AND policyname = 'muscle_recovery_owner') THEN
    CREATE POLICY muscle_recovery_owner ON muscle_recovery
      USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION sync_tables() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['equipment','muscle_group','mobility_area','exercise','exercise_muscle',
    'exercise_mobility_area','workout_template','planned_exercise','scheduled_workout','session',
    'session_exercise','set_log','setting','body_metric','progress_photo','muscle_recovery']
$$;
