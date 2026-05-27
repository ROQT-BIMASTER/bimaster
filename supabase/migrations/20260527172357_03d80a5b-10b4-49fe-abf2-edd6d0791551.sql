
-- Quebra recursão RLS entre projeto_tarefas e projeto_tarefa_colaboradores.
-- "Task collaborators can view own collaborated tasks" fazia EXISTS em
-- projeto_tarefa_colaboradores, e a policy SELECT de colaboradores chama
-- user_can_access_projeto_via_tarefa() que consulta projeto_tarefas.
-- Ciclo => "infinite recursion detected in policy".

CREATE OR REPLACE FUNCTION public.user_is_task_collaborator(_user_id uuid, _tarefa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.projeto_tarefa_colaboradores
     WHERE tarefa_id = _tarefa_id
       AND user_id   = _user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.user_is_task_collaborator(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.user_is_task_collaborator(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Task collaborators can view own collaborated tasks" ON public.projeto_tarefas;
CREATE POLICY "Task collaborators can view own collaborated tasks"
  ON public.projeto_tarefas
  FOR SELECT
  TO authenticated
  USING (public.user_is_task_collaborator((SELECT auth.uid()), id));
