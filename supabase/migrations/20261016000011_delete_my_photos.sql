-- 011 — fotos de progresso só na nuvem se o utilizador quiser.
-- A app passa a enviar fotos apenas com «Sincronizar fotos» ligado (por dispositivo, desligado por defeito).
-- Esta função apaga da nuvem as fotos do utilizador autenticado (as linhas, não só um apagamento lógico),
-- sem tocar no resto dos dados. Os dispositivos ficam com as cópias locais.

CREATE OR REPLACE FUNCTION delete_my_photos() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  uid uuid := current_user_id();
  n bigint;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  WITH d AS (DELETE FROM progress_photo WHERE user_id = uid RETURNING 1) SELECT count(*) INTO n FROM d;
  RETURN jsonb_build_object('progress_photo', n);
END $$;

REVOKE ALL ON FUNCTION delete_my_photos() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION delete_my_photos() FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION delete_my_photos() TO authenticated;
  END IF;
END $$;
