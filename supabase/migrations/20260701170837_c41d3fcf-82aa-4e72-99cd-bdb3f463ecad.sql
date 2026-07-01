DROP POLICY IF EXISTS "Members or assignees can update projeto_tarefas" ON public.projeto_tarefas;

CREATE POLICY "Members or assignees can update projeto_tarefas"
ON public.projeto_tarefas
FOR UPDATE
USING (
  user_can_access_projeto((SELECT auth.uid()), projeto_id)
  OR responsavel_id = (SELECT auth.uid())
  OR criador_id     = (SELECT auth.uid())
  OR EXISTS (SELECT 1 FROM public.projeto_tarefa_responsaveis  r WHERE r.tarefa_id = id AND r.user_id = (SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.projeto_tarefa_colaboradores c WHERE c.tarefa_id = id AND c.user_id = (SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.projeto_tarefa_seguidores    s WHERE s.tarefa_id = id AND s.user_id = (SELECT auth.uid()))
)
WITH CHECK (
  user_can_access_projeto((SELECT auth.uid()), projeto_id)
  OR responsavel_id = (SELECT auth.uid())
  OR criador_id     = (SELECT auth.uid())
  OR EXISTS (SELECT 1 FROM public.projeto_tarefa_responsaveis  r WHERE r.tarefa_id = id AND r.user_id = (SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.projeto_tarefa_colaboradores c WHERE c.tarefa_id = id AND c.user_id = (SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.projeto_tarefa_seguidores    s WHERE s.tarefa_id = id AND s.user_id = (SELECT auth.uid()))
);