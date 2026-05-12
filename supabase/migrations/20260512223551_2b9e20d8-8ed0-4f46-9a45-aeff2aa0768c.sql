-- Audit log para conclusão/reabertura/exclusão de tarefas e subtarefas do módulo Projetos.
CREATE TABLE IF NOT EXISTS public.tarefa_auditoria_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tarefa_id UUID NOT NULL,
  projeto_id UUID,
  parent_tarefa_id UUID,
  user_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('concluida','reaberta','excluida','restaurada')),
  is_subtarefa BOOLEAN NOT NULL DEFAULT false,
  titulo_snapshot TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tarefa_auditoria_log_tarefa ON public.tarefa_auditoria_log(tarefa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tarefa_auditoria_log_projeto ON public.tarefa_auditoria_log(projeto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tarefa_auditoria_log_user ON public.tarefa_auditoria_log(user_id, created_at DESC);

ALTER TABLE public.tarefa_auditoria_log ENABLE ROW LEVEL SECURITY;

-- INSERT: somente o próprio usuário autenticado registra suas ações.
CREATE POLICY "Users insert own tarefa audit"
ON public.tarefa_auditoria_log
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- SELECT: admin/supervisor veem tudo; demais veem apenas logs de projetos
-- aos quais têm acesso via projeto_tarefas (RLS herdada por semi-join).
CREATE POLICY "Admins read all tarefa audit"
ON public.tarefa_auditoria_log
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Project members read tarefa audit"
ON public.tarefa_auditoria_log
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projeto_tarefas pt
    WHERE pt.id = tarefa_auditoria_log.tarefa_id
  )
);

-- Sem UPDATE/DELETE: log é imutável.