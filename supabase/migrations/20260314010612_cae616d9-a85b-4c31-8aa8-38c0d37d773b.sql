
CREATE TABLE public.china_doc_revisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id UUID REFERENCES public.china_produto_documentos(id) ON DELETE CASCADE NOT NULL,
  submissao_id UUID REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE NOT NULL,
  rodada INT NOT NULL DEFAULT 1,
  resultado TEXT NOT NULL,
  motivo_rejeicao TEXT,
  anotacoes JSONB DEFAULT '[]'::jsonb,
  revisado_por UUID,
  contestado_por UUID,
  contestacao_texto TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.china_doc_revisoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage revisoes"
  ON public.china_doc_revisoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.china_doc_revisoes;
