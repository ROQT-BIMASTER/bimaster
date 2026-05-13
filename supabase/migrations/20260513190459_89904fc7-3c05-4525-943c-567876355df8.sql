
REVOKE EXECUTE ON FUNCTION public.rpc_chat_criar_grupo(text,text,text,uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_chat_adicionar_participantes(uuid,uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_chat_remover_participante(uuid,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_chat_promover_admin(uuid,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_chat_sair_grupo(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_chat_marcar_lido(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_chat_criar_grupo(text,text,text,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_chat_adicionar_participantes(uuid,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_chat_remover_participante(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_chat_promover_admin(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_chat_sair_grupo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_chat_marcar_lido(uuid,uuid) TO authenticated;
