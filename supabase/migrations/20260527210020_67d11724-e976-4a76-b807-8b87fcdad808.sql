
CREATE OR REPLACE FUNCTION public.user_is_tarefa_owner_or_creator(_user_id uuid, _tarefa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projeto_tarefas t
    WHERE t.id = _tarefa_id
      AND (t.responsavel_id = _user_id OR t.criador_id = _user_id)
  );
$$;

DROP POLICY IF EXISTS "Members or assignees can insert colaboradores" ON public.projeto_tarefa_colaboradores;
DROP POLICY IF EXISTS "Members or assignees can delete colaboradores" ON public.projeto_tarefa_colaboradores;

CREATE POLICY "Members or assignees can insert colaboradores"
ON public.projeto_tarefa_colaboradores
FOR INSERT TO authenticated
WITH CHECK (
  public.user_can_access_projeto_via_tarefa((SELECT auth.uid()), tarefa_id)
  OR public.user_is_tarefa_owner_or_creator((SELECT auth.uid()), tarefa_id)
);

CREATE POLICY "Members or assignees can delete colaboradores"
ON public.projeto_tarefa_colaboradores
FOR DELETE TO authenticated
USING (
  public.user_can_access_projeto_via_tarefa((SELECT auth.uid()), tarefa_id)
  OR public.user_is_tarefa_owner_or_creator((SELECT auth.uid()), tarefa_id)
);
