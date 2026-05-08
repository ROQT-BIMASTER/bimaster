-- 1) Views: forçar security_invoker (hoje rodam como dono)
ALTER VIEW public.vw_china_oc_recebimento_kpis SET (security_invoker = true);
ALTER VIEW public.vw_china_produto_recebimento_kpis SET (security_invoker = true);

-- 2) Funções com search_path mutável
ALTER FUNCTION public._kanban_coluna_universal(text, integer) SET search_path = public;
ALTER FUNCTION public.fn_despacho_doc_sla_status() SET search_path = public;
ALTER FUNCTION public.update_faee_timestamp() SET search_path = public;

-- 3) Revogar EXECUTE de anon em todas as funções SECURITY DEFINER do schema public.
-- Cada uma já valida auth.uid() internamente; chamadas anônimas devem ser rejeitadas no nível de privilégio.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, public',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;