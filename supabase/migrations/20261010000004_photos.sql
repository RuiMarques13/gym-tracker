-- Fotos de progresso (tabela sincronizada como as outras). Corre depois dos ficheiros 1 a 3.
-- A imagem vai como texto (data URL JPEG reduzida, ≈ 60 KB): 100 fotos ≈ 6 MB dos 500 MB do plano gratuito.
CREATE TABLE IF NOT EXISTS progress_photo (
  user_id uuid NOT NULL,
  id uuid NOT NULL,
  date text NOT NULL,
  pose text NOT NULL DEFAULT 'FRONT' CHECK (pose IN ('FRONT','SIDE','BACK','OTHER')),
  note text,
  image text NOT NULL,
  updated_at timestamptz NOT NULL,
  deleted_at text,
  device_id text NOT NULL,
  server_version bigint NOT NULL DEFAULT nextval('sync_version_seq'),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS ix_progress_photo_cursor ON progress_photo (user_id, server_version);
ALTER TABLE progress_photo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON progress_photo FROM PUBLIC;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'progress_photo' AND policyname = 'progress_photo_owner') THEN
    CREATE POLICY progress_photo_owner ON progress_photo
      USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION sync_tables() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['equipment','muscle_group','mobility_area','exercise','exercise_muscle',
    'exercise_mobility_area','workout_template','planned_exercise','scheduled_workout','session',
    'session_exercise','set_log','setting','body_metric','progress_photo']
$$;
