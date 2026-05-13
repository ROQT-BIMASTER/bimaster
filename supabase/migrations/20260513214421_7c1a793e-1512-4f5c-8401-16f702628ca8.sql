-- Revoke anonymous EXECUTE on sensitive SECURITY DEFINER RPCs
REVOKE EXECUTE ON FUNCTION public.log_fabrica_foto_storage_event() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_china_chat_set_traducao(uuid, text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_china_criar_op(uuid, numeric, uuid, uuid, uuid, text, date, date, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_china_log_evento(text, text, text, jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_china_normalize_legacy_status() FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.log_fabrica_foto_storage_event() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_china_chat_set_traducao(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_china_criar_op(uuid, numeric, uuid, uuid, uuid, text, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_china_log_evento(text, text, text, jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_china_normalize_legacy_status() TO authenticated;