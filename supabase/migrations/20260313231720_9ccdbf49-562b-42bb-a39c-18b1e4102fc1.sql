
-- Centralized module-project linking table
CREATE TABLE public.modulo_projeto_vinculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo TEXT NOT NULL,
  registro_id UUID NOT NULL,
  projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  secao_id UUID REFERENCES projeto_secoes(id) ON DELETE SET NULL,
  tarefa_id UUID REFERENCES projeto_tarefas(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(modulo, registro_id, tarefa_id)
);

ALTER TABLE public.modulo_projeto_vinculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view vinculos" ON public.modulo_projeto_vinculos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert vinculos" ON public.modulo_projeto_vinculos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can delete own vinculos" ON public.modulo_projeto_vinculos
  FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE INDEX idx_modulo_vinculos_registro ON public.modulo_projeto_vinculos(modulo, registro_id);
CREATE INDEX idx_modulo_vinculos_tarefa ON public.modulo_projeto_vinculos(tarefa_id);
CREATE INDEX idx_modulo_vinculos_projeto ON public.modulo_projeto_vinculos(projeto_id);
