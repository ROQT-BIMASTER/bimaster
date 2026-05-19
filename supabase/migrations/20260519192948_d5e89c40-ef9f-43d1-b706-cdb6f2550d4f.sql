
-- 1) Security Definer View → security_invoker
ALTER VIEW public.chat_directory SET (security_invoker = true);

-- 2) Tighten always-true RLS policies
DROP POLICY IF EXISTS "Auth users can insert ficha audit" ON public.fabrica_ficha_revisoes_audit_log;
CREATE POLICY "Auth users can insert ficha audit"
  ON public.fabrica_ficha_revisoes_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "service writes apify run log" ON public.apify_run_log;
CREATE POLICY "service writes apify run log"
  ON public.apify_run_log
  FOR INSERT TO service_role
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can insert security logs" ON public.api_security_log;
CREATE POLICY "Service role can insert security logs"
  ON public.api_security_log
  FOR INSERT TO service_role
  WITH CHECK (auth.role() = 'service_role');

-- 3) Revoke anonymous EXECUTE on SECURITY DEFINER functions that should not be public.
--    Trigger functions and authenticated-only RPCs.
REVOKE EXECUTE ON FUNCTION public.fn_audit_fabrica_ficha_revisoes() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_china_apont_validate_saldo() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_china_documento_on_lote_concluido() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_china_embarque_validate_saldo() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_log_china_documento_versao() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.inbox_backfill_inicial() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_chat_corporativo_mentions() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_china_chat_mentions() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tg_chat_atualiza_ultima_msg() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_urgent_message() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trg_cte_apontamento() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trg_cte_documentos() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trg_cte_embarque() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trg_cte_nc() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trg_cte_oc() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trg_cte_recebimento() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trg_cte_saldo_decisao() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trg_cte_submissoes() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trg_inbox_from_projeto_tarefa() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trg_inbox_resolve_on_tarefa_fechada() FROM anon, public;

REVOKE EXECUTE ON FUNCTION public.rpc_criar_lote_aprovacao_china(uuid, uuid, text, uuid[], date, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rpc_enviar_mensagem_urgente(uuid, text, text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rpc_promover_cenario(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rpc_reabrir_cenario(uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.rpc_criar_lote_aprovacao_china(uuid, uuid, text, uuid[], date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_enviar_mensagem_urgente(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_promover_cenario(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_reabrir_cenario(uuid) TO authenticated;

-- Note: submit_dynamic_form_response and dynamic_form_answer_insert_allowed remain
-- callable by anon (intentional — public dynamic forms).
