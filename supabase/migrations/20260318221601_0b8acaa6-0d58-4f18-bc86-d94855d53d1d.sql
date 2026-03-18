CREATE TABLE public.process_etapas_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_tipo TEXT NOT NULL, -- 'china', 'brasil', 'fabrica'
  etapa_key TEXT NOT NULL,
  etapa_label TEXT NOT NULL,
  ordem INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (produto_tipo, etapa_key)
);

ALTER TABLE public.process_etapas_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read etapas config"
  ON public.process_etapas_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage etapas config"
  ON public.process_etapas_config FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Seed default etapas for all 3 types
INSERT INTO public.process_etapas_config (produto_tipo, etapa_key, etapa_label, ordem) VALUES
  ('china', 'ideia', 'Ideia', 1), ('china', 'projeto', 'Projeto', 2), ('china', 'pre_cadastro', 'Pré-cadastro', 3),
  ('china', 'desenvolvimento', 'Desenvolvimento', 4), ('china', 'testes', 'Testes', 5), ('china', 'embalagem', 'Embalagem', 6),
  ('china', 'regulatorio', 'Regulatório', 7), ('china', 'cadastro_final', 'Cadastro Final', 8), ('china', 'aprovacao', 'Aprovação', 9),
  ('china', 'producao', 'Produção', 10), ('china', 'lancamento', 'Lançamento', 11), ('china', 'recebimento', 'Recebimento Brasil', 12),
  ('brasil', 'ideia', 'Ideia', 1), ('brasil', 'projeto', 'Projeto', 2), ('brasil', 'pre_cadastro', 'Pré-cadastro', 3),
  ('brasil', 'desenvolvimento', 'Desenvolvimento', 4), ('brasil', 'testes', 'Testes', 5), ('brasil', 'embalagem', 'Embalagem', 6),
  ('brasil', 'regulatorio', 'Regulatório', 7), ('brasil', 'cadastro_final', 'Cadastro Final', 8), ('brasil', 'aprovacao', 'Aprovação', 9),
  ('brasil', 'producao', 'Produção', 10), ('brasil', 'lancamento', 'Lançamento', 11), ('brasil', 'recebimento', 'Recebimento Brasil', 12),
  ('fabrica', 'ideia', 'Ideia', 1), ('fabrica', 'projeto', 'Projeto', 2), ('fabrica', 'pre_cadastro', 'Pré-cadastro', 3),
  ('fabrica', 'desenvolvimento', 'Desenvolvimento', 4), ('fabrica', 'testes', 'Testes', 5), ('fabrica', 'embalagem', 'Embalagem', 6),
  ('fabrica', 'regulatorio', 'Regulatório', 7), ('fabrica', 'cadastro_final', 'Cadastro Final', 8), ('fabrica', 'aprovacao', 'Aprovação', 9),
  ('fabrica', 'producao', 'Produção', 10), ('fabrica', 'lancamento', 'Lançamento', 11), ('fabrica', 'recebimento', 'Recebimento Brasil', 12);