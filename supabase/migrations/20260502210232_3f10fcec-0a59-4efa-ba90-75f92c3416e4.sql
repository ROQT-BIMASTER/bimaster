-- Hotfix: restaurar GRANT EXECUTE em funções SECURITY DEFINER usadas por RLS de projetos.
-- Sem esses grants, todas as policies que chamam estas funções falham com
-- "permission denied for function", bloqueando acesso a projetos, perfis e tarefas.

GRANT EXECUTE ON FUNCTION public.check_user_access(uuid, text)                  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_profile(uuid, uuid)                   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_access_projeto(uuid, uuid)            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_access_projeto_via_tarefa(uuid, uuid) TO authenticated, service_role;