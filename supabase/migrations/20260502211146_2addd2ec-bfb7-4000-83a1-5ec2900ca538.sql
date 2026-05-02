-- Hotfix RLS abrangente: GRANT EXECUTE para todas as funções SECURITY DEFINER usadas em policies
DO $$
DECLARE
  fn_record RECORD;
  fn_signature text;
BEGIN
  FOR fn_record IN
    WITH funcs AS (
      SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prosecdef=true
    ),
    granted AS (
      SELECT DISTINCT routine_name FROM information_schema.routine_privileges
      WHERE grantee='authenticated' AND privilege_type='EXECUTE' AND routine_schema='public'
    ),
    used_in_policies AS (
      SELECT DISTINCT (regexp_matches(
        pg_get_expr(polqual, polrelid) || ' ' || COALESCE(pg_get_expr(polwithcheck, polrelid),''),
        '([a-z_][a-z0-9_]*)\s*\(', 'g'
      ))[1] AS fname
      FROM pg_policy
    )
    SELECT f.proname, f.args
    FROM funcs f
    LEFT JOIN granted g ON g.routine_name = f.proname
    WHERE g.routine_name IS NULL
      AND f.proname IN (SELECT fname FROM used_in_policies)
  LOOP
    fn_signature := format('public.%I(%s)', fn_record.proname, fn_record.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn_signature);
    RAISE NOTICE 'Granted EXECUTE on %', fn_signature;
  END LOOP;
END $$;