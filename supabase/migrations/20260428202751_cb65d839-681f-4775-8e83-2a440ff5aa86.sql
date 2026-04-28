DROP POLICY IF EXISTS "Task collaborators can view own collaborated tasks" ON public.projeto_tarefas;

CREATE POLICY "Task collaborators can view own collaborated tasks"
ON public.projeto_tarefas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projeto_tarefa_colaboradores c
    WHERE c.tarefa_id = projeto_tarefas.id
      AND c.user_id = auth.uid()
  )
);