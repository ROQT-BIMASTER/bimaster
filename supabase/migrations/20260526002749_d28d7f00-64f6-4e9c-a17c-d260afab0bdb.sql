-- Revoga EXECUTE de anon (e PUBLIC) em SECURITY DEFINER functions do schema public
-- que não devem ser chamáveis sem autenticação.
-- Mantém aberto apenas submit_dynamic_form_response (formulário público via token).

REVOKE EXECUTE ON FUNCTION public.briefing_seed_creator_membro() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access_briefing(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_edit_briefing(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_briefing(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.crm_bot_upsert(uuid, integer, text, text, crm_provider, crm_canal, text, text, text, boolean, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.crm_has_access(integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.crm_is_admin(integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.dynamic_form_answer_insert_allowed(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_fabrica_recalc_custo_final(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_revisoes_plano_historico_mensal(uuid, text[], text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_briefing_comentario_mentions() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rpc_aceitar_sugestao_briefing(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rpc_desvincular_concorrente_sugestao(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rpc_get_filiais_plano_reducao(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rpc_get_revisao_documentos_mes(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rpc_get_revisao_documentos_mes(text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rpc_padronizar_insumo_duplicado(text[], text, text, text, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rpc_promover_vencedor_sugestao(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rpc_reabrir_disputa_sugestao(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rpc_rejeitar_sugestao_briefing(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rpc_sugerir_fornecedores_ap(text, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rpc_vincular_concorrente_sugestao(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_suporte_ticket_prazo() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tg_fabrica_recalc_custo_after_change() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tg_mensagens_suporte_privacy() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trg_push_on_mensagem() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trg_push_on_notification() FROM anon, public;

-- Garante que usuários autenticados continuam podendo executar as RPCs de negócio
GRANT EXECUTE ON FUNCTION public.can_access_briefing(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_briefing(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_briefing(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_bot_upsert(uuid, integer, text, text, crm_provider, crm_canal, text, text, text, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_has_access(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_is_admin(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fabrica_recalc_custo_final(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_revisoes_plano_historico_mensal(uuid, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_aceitar_sugestao_briefing(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_desvincular_concorrente_sugestao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_filiais_plano_reducao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_revisao_documentos_mes(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_revisao_documentos_mes(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_padronizar_insumo_duplicado(text[], text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_promover_vencedor_sugestao(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_reabrir_disputa_sugestao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_rejeitar_sugestao_briefing(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sugerir_fornecedores_ap(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_vincular_concorrente_sugestao(uuid, uuid) TO authenticated;

-- submit_dynamic_form_response permanece acessível a anon (formulário público via token)
-- e dynamic_form_answer_insert_allowed é usada via trigger/RLS, não precisa de EXECUTE direto.
