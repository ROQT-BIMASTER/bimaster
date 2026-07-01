
CREATE OR REPLACE FUNCTION public.user_owns_parent_tarefa(_user_id uuid, _parent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projeto_tarefas p
    WHERE p.id = _parent_id
      AND (p.responsavel_id = _user_id OR p.criador_id = _user_id)
  )
$$;

DROP POLICY IF EXISTS "Members or task owners can insert" ON public.projeto_tarefas;
CREATE POLICY "Members or task owners can insert"
ON public.projeto_tarefas
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_can_access_projeto((SELECT auth.uid()), projeto_id)
  OR responsavel_id = (SELECT auth.uid())
  OR criador_id     = (SELECT auth.uid())
  OR (parent_tarefa_id IS NOT NULL
      AND public.user_owns_parent_tarefa((SELECT auth.uid()), parent_tarefa_id))
);

DROP POLICY IF EXISTS "Members or task owners can delete" ON public.projeto_tarefas;
CREATE POLICY "Members or task owners can delete"
ON public.projeto_tarefas
FOR DELETE
TO authenticated
USING (
  public.user_can_access_projeto((SELECT auth.uid()), projeto_id)
  OR responsavel_id = (SELECT auth.uid())
  OR criador_id     = (SELECT auth.uid())
  OR (parent_tarefa_id IS NOT NULL
      AND public.user_owns_parent_tarefa((SELECT auth.uid()), parent_tarefa_id))
);
