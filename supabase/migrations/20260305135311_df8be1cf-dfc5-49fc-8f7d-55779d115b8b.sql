
-- Add secao_id to projeto_calendario_regras for section-scoped rules
ALTER TABLE public.projeto_calendario_regras 
ADD COLUMN secao_id UUID REFERENCES public.projeto_secoes(id) ON DELETE CASCADE;

-- Create task-level metas table
CREATE TABLE public.projeto_tarefa_metas_calendario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  tarefa_id UUID NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'prazo_limite',
  valor TEXT,
  cumprida BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_tarefa_metas_calendario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage task metas"
ON public.projeto_tarefa_metas_calendario
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
