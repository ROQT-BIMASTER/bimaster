-- Onda 1: índices compostos para hot paths do módulo Projetos
CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_comentarios_tarefa_created
  ON public.projeto_tarefa_comentarios (tarefa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_anexos_tarefa_created
  ON public.projeto_tarefa_anexos (tarefa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projeto_atividades_projeto_created
  ON public.projeto_atividades (projeto_id, created_at DESC);

-- Estatísticas atualizadas para o planner
ANALYZE public.projeto_tarefa_comentarios;
ANALYZE public.projeto_tarefa_anexos;
ANALYZE public.projeto_atividades;