-- Espelha o escopo da policy SELECT "Task owners can view own assigned tasks"
-- nas operações de UPDATE/INSERT/DELETE para evitar silent fail por RLS.

DROP POLICY IF EXISTS "Members can update projeto_tarefas" ON public.projeto_tarefas;
DROP POLICY IF EXISTS "Members or assignees can update projeto_tarefas" ON public.projeto_tarefas;

CREATE POLICY "Members or assignees can update projeto_tarefas"
ON public.projeto_tarefas
FOR UPDATE TO authenticated
USING (
  public.user_can_access_projeto((select auth.uid()), projeto_id)
  OR responsavel_id = (select auth.uid())
  OR criador_id    = (select auth.uid())
)
WITH CHECK (
  public.user_can_access_projeto((select auth.uid()), projeto_id)
  OR responsavel_id = (select auth.uid())
  OR criador_id    = (select auth.uid())
);

COMMENT ON POLICY "Members or assignees can update projeto_tarefas" ON public.projeto_tarefas IS
  'Membros do projeto, responsavel atual e criador da tarefa podem atualiza-la. Espelha o escopo da policy SELECT "Task owners can view own assigned tasks" para evitar silent fail em UPDATE.';

DROP POLICY IF EXISTS "Members can insert colaboradores" ON public.projeto_tarefa_colaboradores;
DROP POLICY IF EXISTS "Members or assignees can insert colaboradores" ON public.projeto_tarefa_colaboradores;

CREATE POLICY "Members or assignees can insert colaboradores"
ON public.projeto_tarefa_colaboradores
FOR INSERT TO authenticated
WITH CHECK (
  public.user_can_access_projeto_via_tarefa((select auth.uid()), tarefa_id)
  OR EXISTS (
    SELECT 1 FROM public.projeto_tarefas t
    WHERE t.id = projeto_tarefa_colaboradores.tarefa_id
      AND (t.responsavel_id = (select auth.uid()) OR t.criador_id = (select auth.uid()))
  )
);

COMMENT ON POLICY "Members or assignees can insert colaboradores" ON public.projeto_tarefa_colaboradores IS
  'Membros do projeto, responsavel atual e criador da tarefa podem adicionar seguidores.';

DROP POLICY IF EXISTS "Members can delete colaboradores" ON public.projeto_tarefa_colaboradores;
DROP POLICY IF EXISTS "Members or assignees can delete colaboradores" ON public.projeto_tarefa_colaboradores;

CREATE POLICY "Members or assignees can delete colaboradores"
ON public.projeto_tarefa_colaboradores
FOR DELETE TO authenticated
USING (
  public.user_can_access_projeto_via_tarefa((select auth.uid()), tarefa_id)
  OR EXISTS (
    SELECT 1 FROM public.projeto_tarefas t
    WHERE t.id = projeto_tarefa_colaboradores.tarefa_id
      AND (t.responsavel_id = (select auth.uid()) OR t.criador_id = (select auth.uid()))
  )
);

COMMENT ON POLICY "Members or assignees can delete colaboradores" ON public.projeto_tarefa_colaboradores IS
  'Membros do projeto, responsavel atual e criador da tarefa podem remover seguidores.';