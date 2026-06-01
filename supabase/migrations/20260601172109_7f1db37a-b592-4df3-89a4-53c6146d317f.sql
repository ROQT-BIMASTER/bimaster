REVOKE ALL ON FUNCTION public.rpc_soft_delete_projeto(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_soft_delete_projeto(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_soft_delete_projeto(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_soft_delete_projeto(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.user_can_manage_all_projetos(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_can_manage_all_projetos(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_can_manage_all_projetos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_manage_all_projetos(uuid) TO service_role;