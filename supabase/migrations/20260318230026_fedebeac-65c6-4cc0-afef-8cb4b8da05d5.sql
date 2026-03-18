
-- Table: process_despacho_documento
CREATE TABLE public.process_despacho_documento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id UUID NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  documento_id UUID NOT NULL REFERENCES public.china_produto_documentos(id) ON DELETE CASCADE,
  processo_id UUID REFERENCES public.product_process(id) ON DELETE SET NULL,
  numero_anexo INT NOT NULL DEFAULT 1,
  categoria_checklist TEXT,
  departamento_destino_id UUID REFERENCES public.departamentos(id) ON DELETE SET NULL,
  modulo_destino TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  parecer_texto TEXT,
  parecer_por UUID,
  parecer_por_nome TEXT,
  parecer_data TIMESTAMPTZ,
  devolvido_china BOOLEAN NOT NULL DEFAULT FALSE,
  devolvido_china_data TIMESTAMPTZ,
  workflow_config_id UUID,
  etapa_atual INT NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.process_despacho_documento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage despachos"
  ON public.process_despacho_documento
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Table: process_despacho_transicoes
CREATE TABLE public.process_despacho_transicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id UUID NOT NULL REFERENCES public.process_despacho_documento(id) ON DELETE CASCADE,
  etapa_nome TEXT,
  acao TEXT NOT NULL,
  usuario_id UUID,
  usuario_nome TEXT,
  departamento_id UUID REFERENCES public.departamentos(id) ON DELETE SET NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.process_despacho_transicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage transicoes"
  ON public.process_despacho_transicoes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_despacho_doc_submissao ON public.process_despacho_documento(submissao_id);
CREATE INDEX idx_despacho_doc_documento ON public.process_despacho_documento(documento_id);
CREATE INDEX idx_despacho_doc_status ON public.process_despacho_documento(status);
CREATE INDEX idx_despacho_transicoes_despacho ON public.process_despacho_transicoes(despacho_id);
