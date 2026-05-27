DROP POLICY IF EXISTS "Members can insert tarefa responsaveis" ON public.projeto_tarefa_responsaveis;
DROP POLICY IF EXISTS "Members or assignees can insert tarefa responsaveis" ON public.projeto_tarefa_responsaveis;

CREATE POLICY "Members or assignees can insert tarefa responsaveis"
ON public.projeto_tarefa_responsaveis
FOR INSERT TO authenticated
WITH CHECK (
  public.user_can_access_projeto_via_tarefa((select auth.uid()), tarefa_id)
  OR EXISTS (
    SELECT 1 FROM public.projeto_tarefas t
    WHERE t.id = projeto_tarefa_responsaveis.tarefa_id
      AND (t.responsavel_id = (select auth.uid()) OR t.criador_id = (select auth.uid()))
  )
);

DROP POLICY IF EXISTS "Members can delete tarefa responsaveis" ON public.projeto_tarefa_responsaveis;
DROP POLICY IF EXISTS "Members or assignees can delete tarefa responsaveis" ON public.projeto_tarefa_responsaveis;

CREATE POLICY "Members or assignees can delete tarefa responsaveis"
ON public.projeto_tarefa_responsaveis
FOR DELETE TO authenticated
USING (
  public.user_can_access_projeto_via_tarefa((select auth.uid()), tarefa_id)
  OR EXISTS (
    SELECT 1 FROM public.projeto_tarefas t
    WHERE t.id = projeto_tarefa_responsaveis.tarefa_id
      AND (t.responsavel_id = (select auth.uid()) OR t.criador_id = (select auth.uid()))
  )
);

COMMENT ON POLICY "Members or assignees can insert tarefa responsaveis" ON public.projeto_tarefa_responsaveis IS
  'Membros do projeto, responsavel atual e criador da tarefa podem adicionar responsaveis.';
COMMENT ON POLICY "Members or assignees can delete tarefa responsaveis" ON public.projeto_tarefa_responsaveis IS
  'Membros do projeto, responsavel atual e criador da tarefa podem remover responsaveis.';