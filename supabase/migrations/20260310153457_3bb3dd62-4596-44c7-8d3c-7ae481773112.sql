CREATE TABLE public.china_submissao_tarefa_vinculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id UUID NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  tarefa_id UUID NOT NULL,
  secao_id UUID REFERENCES public.projeto_secoes(id) ON DELETE CASCADE,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  audit_result JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(submissao_id, tarefa_id)
);

ALTER TABLE public.china_submissao_tarefa_vinculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage vinculos" ON public.china_submissao_tarefa_vinculos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);