
-- Add planning fields to projeto_tarefas
ALTER TABLE public.projeto_tarefas 
  ADD COLUMN IF NOT EXISTS data_inicio_planejada date,
  ADD COLUMN IF NOT EXISTS dias_alerta_antes integer NOT NULL DEFAULT 2;

-- Create projeto_tarefa_metas table for intermediate milestones
CREATE TABLE IF NOT EXISTS public.projeto_tarefa_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  data_meta date,
  concluida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projeto_tarefa_metas ENABLE ROW LEVEL SECURITY;

-- RLS policies for projeto_tarefa_metas (authenticated users can CRUD)
CREATE POLICY "Authenticated users can select metas" ON public.projeto_tarefa_metas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert metas" ON public.projeto_tarefa_metas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update metas" ON public.projeto_tarefa_metas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete metas" ON public.projeto_tarefa_metas
  FOR DELETE TO authenticated USING (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_metas_tarefa_id ON public.projeto_tarefa_metas(tarefa_id);
