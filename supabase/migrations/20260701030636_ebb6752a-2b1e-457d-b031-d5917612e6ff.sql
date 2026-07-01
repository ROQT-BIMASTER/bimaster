-- Permitir que o criador e o responsável de uma tarefa possam criar e apagar subtarefas
-- (em qualquer profundidade), mesmo que não sejam membros formais do projeto.
-- Antes: INSERT/DELETE exigiam user_can_access_projeto, o que bloqueava usuários
-- apenas marcados como responsáveis de uma subtarefa filha.

DROP POLICY IF EXISTS "Members can insert projeto_tarefas" ON public.projeto_tarefas;
CREATE POLICY "Members or task owners can insert projeto_tarefas"
  ON public.projeto_tarefas
  FOR INSERT
  WITH CHECK (
    public.user_can_access_projeto((SELECT auth.uid()), projeto_id)
    OR responsavel_id = (SELECT auth.uid())
    OR criador_id = (SELECT auth.uid())
    OR (
      parent_tarefa_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.projeto_tarefas p
        WHERE p.id = projeto_tarefas.parent_tarefa_id
          AND (
            p.responsavel_id = (SELECT auth.uid())
            OR p.criador_id = (SELECT auth.uid())
          )
      )
    )
  );

DROP POLICY IF EXISTS "Members can delete projeto_tarefas" ON public.projeto_tarefas;
CREATE POLICY "Members or task owners can delete projeto_tarefas"
  ON public.projeto_tarefas
  FOR DELETE
  USING (
    public.user_can_access_projeto((SELECT auth.uid()), projeto_id)
    OR responsavel_id = (SELECT auth.uid())
    OR criador_id = (SELECT auth.uid())
    OR (
      parent_tarefa_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.projeto_tarefas p
        WHERE p.id = projeto_tarefas.parent_tarefa_id
          AND (
            p.responsavel_id = (SELECT auth.uid())
            OR p.criador_id = (SELECT auth.uid())
          )
      )
    )
  );