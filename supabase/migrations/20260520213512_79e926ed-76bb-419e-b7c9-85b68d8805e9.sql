
REVOKE EXECUTE ON FUNCTION public.gen_codigo_intake_demanda() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gen_codigo_briefing() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calc_briefing_status(text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calc_completeness(integer, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_lookup_catalogo(integer, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_criar_lote_briefings(uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.briefings_recalc_completeness_fn() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.briefings_audit_fn() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.calc_briefing_status(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calc_completeness(integer, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lookup_catalogo(integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_criar_lote_briefings(uuid, jsonb) TO authenticated;
