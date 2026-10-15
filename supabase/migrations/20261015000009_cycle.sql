-- Ciclos de treino (macrociclo; mesociclos e semanas em plan, JSON). Corre depois dos ficheiros 1 a 8.
-- Seguro correr mais de uma vez.
CREATE TABLE IF NOT EXISTS training_cycle (
  user_id uuid NOT NULL,
  id uuid NOT NULL,
  name text NOT NULL,
  goal text NOT NULL,
  template text NOT NULL,
  start_date text NOT NULL,
  plan text NOT NULL,
  notes text,
  archived_at text,
  updated_at timestamptz NOT NULL,
  deleted_at text,
  device_id text NOT NULL,
  server_version bigint NOT NULL DEFAULT nextval('sync_version_seq'),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS ix_training_cycle_cursor ON training_cycle (user_id, server_version);
ALTER TABLE training_cycle ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON training_cycle FROM PUBLIC;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'training_cycle' AND policyname = 'training_cycle_owner') THEN
    CREATE POLICY training_cycle_owner ON training_cycle
      USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION sync_tables() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['equipment','muscle_group','mobility_area','exercise','exercise_muscle',
    'exercise_mobility_area','workout_template','planned_exercise','scheduled_workout','session',
    'session_exercise','set_log','setting','body_metric','progress_photo','muscle_recovery','suggestion','training_cycle']
$$;
