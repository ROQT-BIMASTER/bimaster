
ALTER VIEW public.vw_op_pronto_embarque SET (security_invoker = true);
ALTER VIEW public.vw_container_consolidado SET (security_invoker = true);

REVOKE EXECUTE ON FUNCTION public.rpc_alocar_op_em_container(uuid,uuid,int,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rpc_criar_container_consolidado(jsonb,jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rpc_fechar_container(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.rpc_alocar_op_em_container(uuid,uuid,int,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_criar_container_consolidado(jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_fechar_container(uuid) TO authenticated;
