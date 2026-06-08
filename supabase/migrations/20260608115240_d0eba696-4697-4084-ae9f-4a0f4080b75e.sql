-- Revoga EXECUTE para anon/PUBLIC em funções SECURITY DEFINER que não devem ser
-- chamáveis sem autenticação. Mantém `submit_dynamic_form_response` acessível ao
-- anon pois é usada pela submissão pública de formulários dinâmicos.

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.prosecdef = true
       AND n.nspname = 'public'
       AND p.proname <> 'submit_dynamic_form_response'
       AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, PUBLIC',
      fn.nspname, fn.proname, fn.args
    );
  END LOOP;
END $$;