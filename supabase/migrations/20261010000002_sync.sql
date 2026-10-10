-- Gym Tracker — funções de sync (Fase 2). Contrato: protocol_version 1.
--
--   sync_push(payload jsonb) -> jsonb
--     payload = { "protocol_version": 1, "device_id": "...", "tables": { "<tabela>": [linhas...] } }
--     Last-write-wins por linha: ganha o maior (updated_at, device_id); empate não reescreve.
--     updated_at é limitado ao relógio do servidor. Tudo ou nada: um erro desfaz o lote.
--
--   sync_pull(p_since bigint, p_limit int) -> jsonb
--     Devolve as linhas com server_version > p_since, por ordem de server_version, no máximo
--     p_limit versões. Se has_more for true, repetir com since = cursor.
--
-- Em Spring Boot: POST /sync/push e GET /sync/pull com os mesmos payloads.

CREATE OR REPLACE FUNCTION sync_tables() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['equipment','muscle_group','mobility_area','exercise','exercise_muscle',
    'exercise_mobility_area','workout_template','planned_exercise','scheduled_workout','session',
    'session_exercise','set_log','setting','body_metric']
$$;

-- Colunas sincronizáveis de uma tabela (tudo menos user_id e server_version), na ordem do esquema.
CREATE OR REPLACE FUNCTION sync_columns(tbl text) RETURNS text[]
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT array_agg(attname::text ORDER BY attnum)
  FROM pg_attribute
  WHERE attrelid = format('public.%I', tbl)::regclass
    AND attnum > 0 AND NOT attisdropped
    AND attname NOT IN ('user_id', 'server_version')
$$;

CREATE OR REPLACE FUNCTION sync_push(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  uid uuid := current_user_id();
  t text;
  rows jsonb;
  cols text[];
  c text;
  col_list text;
  sel_list text;
  set_list text;
  filter text;
  n_in integer;
  n_ok bigint;
  total integer := 0;
  applied jsonb := '{}'::jsonb;
  skipped jsonb := '{}'::jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF payload IS NULL OR jsonb_typeof(payload) IS DISTINCT FROM 'object' OR jsonb_typeof(payload -> 'tables') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid payload' USING ERRCODE = '22023';
  END IF;
  IF (payload ->> 'protocol_version') IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'unsupported protocol_version %', payload ->> 'protocol_version' USING ERRCODE = '22023';
  END IF;

  -- Um push de cada vez por utilizador: garante que as server_version de um utilizador
  -- são confirmadas pela ordem em que foram atribuídas (o cursor do pull nunca salta linhas).
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  FOREACH t IN ARRAY sync_tables() LOOP
    rows := payload -> 'tables' -> t;
    CONTINUE WHEN rows IS NULL OR jsonb_typeof(rows) <> 'array';
    n_in := jsonb_array_length(rows);
    CONTINUE WHEN n_in = 0;
    total := total + n_in;
    IF total > 20000 THEN
      RAISE EXCEPTION 'batch too large (max 20000 rows)' USING ERRCODE = '54000';
    END IF;

    cols := sync_columns(t);
    col_list := ''; sel_list := ''; set_list := '';
    FOREACH c IN ARRAY cols LOOP
      col_list := col_list || format('%I, ', c);
      IF c = 'updated_at' THEN
        sel_list := sel_list || 'date_trunc(''milliseconds'', least(r.updated_at, clock_timestamp())), ';
      ELSE
        sel_list := sel_list || format('r.%I, ', c);
      END IF;
      IF c <> 'id' THEN
        set_list := set_list || format('%I = EXCLUDED.%I, ', c, c);
      END IF;
    END LOOP;
    -- as definições deste dispositivo nunca vão para o servidor
    filter := CASE WHEN t = 'setting' THEN 'WHERE r.scope IS DISTINCT FROM ''DEVICE''' ELSE '' END;

    EXECUTE format(
      'WITH ins AS (
         INSERT INTO %1$I AS tt (user_id, %2$sserver_version)
         SELECT $1, %3$snextval(''sync_version_seq'')
         FROM jsonb_populate_recordset(NULL::%1$I, $2) r %4$s
         ON CONFLICT (user_id, id) DO UPDATE SET %5$sserver_version = EXCLUDED.server_version
         WHERE (tt.updated_at, tt.device_id COLLATE "C") < (EXCLUDED.updated_at, EXCLUDED.device_id COLLATE "C")
         RETURNING 1)
       SELECT count(*) FROM ins',
      t, col_list, sel_list, filter, set_list)
    INTO n_ok USING uid, rows;

    applied := applied || jsonb_build_object(t, n_ok);
    skipped := skipped || jsonb_build_object(t, n_in - n_ok);
  END LOOP;

  RETURN jsonb_build_object(
    'protocol_version', 1,
    'applied', applied,
    'skipped', skipped,
    'server_time', iso_ts(clock_timestamp()));
END $$;

CREATE OR REPLACE FUNCTION sync_pull(p_since bigint DEFAULT 0, p_limit integer DEFAULT 1000) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  uid uuid := current_user_id();
  t text;
  union_sql text := '';
  versions bigint[];
  lim integer := LEAST(GREATEST(COALESCE(p_limit, 1000), 1), 5000);
  since bigint := COALESCE(p_since, 0);
  cutoff bigint;
  has_more boolean;
  part jsonb;
  result jsonb := '{}'::jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  FOREACH t IN ARRAY sync_tables() LOOP
    IF union_sql <> '' THEN union_sql := union_sql || ' UNION ALL '; END IF;
    union_sql := union_sql || format(
      'SELECT server_version AS v FROM %I WHERE user_id = $1 AND server_version > $2', t);
  END LOOP;

  -- as primeiras lim+1 versões (globalmente ordenadas) para saber o corte e se há mais
  EXECUTE format('SELECT array_agg(v ORDER BY v) FROM (SELECT v FROM (%s) x ORDER BY v LIMIT $3) y', union_sql)
  INTO versions USING uid, since, lim + 1;

  IF versions IS NULL THEN
    cutoff := since;
    has_more := false;
  ELSE
    has_more := array_length(versions, 1) > lim;
    cutoff := versions[LEAST(lim, array_length(versions, 1))];
  END IF;

  IF cutoff > since THEN
    FOREACH t IN ARRAY sync_tables() LOOP
      EXECUTE format(
        'SELECT COALESCE(jsonb_agg(((to_jsonb(tt) - ''user_id'') || jsonb_build_object(''updated_at'', iso_ts(tt.updated_at)))
                                   ORDER BY tt.server_version), ''[]''::jsonb)
         FROM %I tt WHERE tt.user_id = $1 AND tt.server_version > $2 AND tt.server_version <= $3', t)
      INTO part USING uid, since, cutoff;
      IF jsonb_array_length(part) > 0 THEN
        result := result || jsonb_build_object(t, part);
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'protocol_version', 1,
    'cursor', cutoff,
    'has_more', has_more,
    'tables', result,
    'server_time', iso_ts(clock_timestamp()));
END $$;

-- Apaga todos os dados do utilizador autenticado (a conta em si apaga-se no fornecedor de login).
CREATE OR REPLACE FUNCTION delete_my_data() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  uid uuid := current_user_id();
  t text;
  n bigint;
  removed jsonb := '{}'::jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  FOR t IN SELECT unnest(sync_tables()) LOOP
    EXECUTE format('WITH d AS (DELETE FROM %I WHERE user_id = $1 RETURNING 1) SELECT count(*) FROM d', t)
    INTO n USING uid;
    removed := removed || jsonb_build_object(t, n);
  END LOOP;
  RETURN removed;
END $$;

-- ---------------------------------------------------------------------------
-- Permissões. Só as funções são a API; as tabelas ficam fechadas.
-- Os papéis anon/authenticated só existem no Supabase, por isso tudo está protegido por EXISTS.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION sync_push(jsonb), sync_pull(bigint, integer), delete_my_data() FROM PUBLIC;
REVOKE ALL ON SEQUENCE sync_version_seq FROM PUBLIC;

DO $$
DECLARE r text; t text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      FOREACH t IN ARRAY sync_tables() LOOP
        EXECUTE format('REVOKE ALL ON %I FROM %I', t, r);
      END LOOP;
      EXECUTE format('REVOKE ALL ON SEQUENCE sync_version_seq FROM %I', r);
      EXECUTE format('REVOKE ALL ON FUNCTION sync_push(jsonb), sync_pull(bigint, integer), delete_my_data() FROM %I', r);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION sync_push(jsonb), sync_pull(bigint, integer), delete_my_data() TO authenticated;
  END IF;
END $$;
