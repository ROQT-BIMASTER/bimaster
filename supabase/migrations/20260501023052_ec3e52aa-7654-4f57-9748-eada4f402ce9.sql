
-- Revogar EXECUTE de authenticated em funções DEFINER que são triggers
-- (triggers nunca são chamadas via API REST, apenas pelo Postgres internamente)
DO $$
DECLARE
  r record;
  cnt int := 0;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND pg_get_function_result(p.oid) = 'trigger'
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
                     r.nspname, r.proname, r.args);
      cnt := cnt + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skip %.%(%): %', r.nspname, r.proname, r.args, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'Revoked authenticated EXECUTE from % trigger functions', cnt;
END $$;

-- Mover pg_net para extensions (com cascade nos objetos dependentes)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_net' AND n.nspname='public') THEN
    BEGIN
      EXECUTE 'ALTER EXTENSION pg_net SET SCHEMA extensions';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_net move skipped (likely in-use): %', SQLERRM;
    END;
  END IF;
END $$;
