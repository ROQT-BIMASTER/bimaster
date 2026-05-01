
-- =====================================================================
-- FASE 1 — Hardening do Banco: fechar 754 findings de segurança
-- =====================================================================
-- 1) Revoga EXECUTE de anon/public em TODAS as funções SECURITY DEFINER
--    do schema public (mantém para authenticated e service_role).
-- 2) Garante search_path imutável em todas as funções DEFINER.
-- 3) Move extensões pg_trgm e pg_net para schema dedicado "extensions".
-- 4) Força security_invoker=true em todas as views do schema public.
-- 5) Cria invariantes de segurança verificáveis por CI.
-- =====================================================================

-- ---------- 0) Schema dedicado para extensões ----------
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role;

-- ---------- 1) Revogar EXECUTE de anon/public em funções DEFINER ----------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
                     r.nspname, r.proname, r.args);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role',
                     r.nspname, r.proname, r.args);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skip %.%(%): %', r.nspname, r.proname, r.args, SQLERRM;
    END;
  END LOOP;
END $$;

-- ---------- 2) Forçar search_path em funções DEFINER que ainda não têm ----------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND (p.proconfig IS NULL OR NOT (array_to_string(p.proconfig, ',') ILIKE '%search_path%'))
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp',
                     r.nspname, r.proname, r.args);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skip alter %.%(%): %', r.nspname, r.proname, r.args, SQLERRM;
    END;
  END LOOP;
END $$;

-- ---------- 3) Mover extensões para schema "extensions" ----------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_trgm' AND n.nspname='public') THEN
    EXECUTE 'ALTER EXTENSION pg_trgm SET SCHEMA extensions';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm move skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_net' AND n.nspname='public') THEN
    EXECUTE 'ALTER EXTENSION pg_net SET SCHEMA extensions';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net move skipped: %', SQLERRM;
END $$;

-- Garantir search_path inclui extensions para resoluções
ALTER DATABASE postgres SET search_path = public, extensions;

-- ---------- 4) Forçar security_invoker=true em todas as views públicas ----------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.oid, n.nspname, c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='v' AND n.nspname='public'
  LOOP
    BEGIN
      EXECUTE format('ALTER VIEW %I.%I SET (security_invoker = true)', r.nspname, r.relname);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skip view %.%: %', r.nspname, r.relname, SQLERRM;
    END;
  END LOOP;
END $$;

-- ---------- 5) Função de invariantes para CI/monitoramento ----------
CREATE OR REPLACE FUNCTION public.security_invariants_check()
RETURNS TABLE(check_name text, status text, details text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. Funções DEFINER com EXECUTE para anon
  RETURN QUERY
  SELECT 'definer_anon_executable'::text,
         CASE WHEN COUNT(*)=0 THEN 'OK' ELSE 'FAIL' END,
         COALESCE(string_agg(p.proname, ', '), '')
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.prosecdef=true
    AND has_function_privilege('anon', p.oid, 'EXECUTE')=true;

  -- 2. Funções DEFINER sem search_path
  RETURN QUERY
  SELECT 'definer_missing_search_path'::text,
         CASE WHEN COUNT(*)=0 THEN 'OK' ELSE 'FAIL' END,
         COALESCE(string_agg(p.proname, ', '), '')
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.prosecdef=true
    AND (p.proconfig IS NULL OR NOT (array_to_string(p.proconfig, ',') ILIKE '%search_path%'));

  -- 3. Extensões em public
  RETURN QUERY
  SELECT 'extensions_in_public'::text,
         CASE WHEN COUNT(*)=0 THEN 'OK' ELSE 'FAIL' END,
         COALESCE(string_agg(e.extname, ', '), '')
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid=e.extnamespace
  WHERE n.nspname='public';

  -- 4. Views sem security_invoker
  RETURN QUERY
  SELECT 'views_without_security_invoker'::text,
         CASE WHEN COUNT(*)=0 THEN 'OK' ELSE 'FAIL' END,
         COALESCE(string_agg(c.relname, ', '), '')
  FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.relkind='v' AND n.nspname='public'
    AND NOT COALESCE((SELECT (option_value)::boolean
                      FROM pg_options_to_table(c.reloptions)
                      WHERE option_name='security_invoker'), false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.security_invariants_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.security_invariants_check() TO authenticated, service_role;

COMMENT ON FUNCTION public.security_invariants_check() IS
  'Retorna FAIL se houver: funções DEFINER executáveis por anon, sem search_path, extensões em public, ou views sem security_invoker.';
