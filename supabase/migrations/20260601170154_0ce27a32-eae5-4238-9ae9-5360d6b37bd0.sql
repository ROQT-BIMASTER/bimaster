REVOKE EXECUTE ON FUNCTION public._anexo_chat_validate(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_arquivar_anexo_chat_projeto(UUID, UUID, TEXT, TEXT, TEXT, TEXT, BIGINT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_arquivar_anexo_chat_tarefa(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, BIGINT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_arquivar_anexo_chat_briefing(UUID, UUID, TEXT, TEXT, TEXT, TEXT, BIGINT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_arquivar_anexo_chat_china(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;