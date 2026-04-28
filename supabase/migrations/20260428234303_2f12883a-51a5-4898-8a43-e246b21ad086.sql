REVOKE EXECUTE ON FUNCTION public.get_minhas_tarefas_central() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_minhas_tarefas_central() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_minhas_tarefas_central() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_can_access_secao(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_can_access_secao(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_secao(uuid, uuid) TO authenticated;