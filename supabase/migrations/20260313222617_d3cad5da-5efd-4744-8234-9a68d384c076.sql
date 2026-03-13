
-- Tabela principal: Análise de Embalagem (Primary Package)
CREATE TABLE public.produto_analise_embalagem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id UUID NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  linha_marca TEXT,
  produto_nome TEXT NOT NULL,
  
  -- Especificações técnicas
  tube_translucent BOOLEAN DEFAULT false,
  tube_shiny BOOLEAN DEFAULT false,
  cap_matte BOOLEAN DEFAULT false,
  cap_outro TEXT,
  finishing_embossed BOOLEAN DEFAULT false,
  finishing_translucent BOOLEAN DEFAULT false,
  finishing_outro TEXT,
  colors_product_color BOOLEAN DEFAULT false,
  colors_white BOOLEAN DEFAULT false,
  
  -- Fotos de referência (array de URLs)
  fotos_referencia JSONB DEFAULT '[]'::jsonb,
  
  -- Status de aprovação
  status_aprovacao TEXT NOT NULL DEFAULT 'pendente' CHECK (status_aprovacao IN ('pendente','approved','approved_with_changes','not_approved')),
  descricao_alteracoes TEXT,
  
  aprovado_por UUID,
  aprovado_em TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de cores da embalagem
CREATE TABLE public.produto_embalagem_cores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analise_id UUID NOT NULL REFERENCES public.produto_analise_embalagem(id) ON DELETE CASCADE,
  codigo_cor TEXT NOT NULL,
  pantone_ref TEXT,
  cor_hex TEXT,
  swatch_url TEXT,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de solicitação formal de amostra à China
CREATE TABLE public.produto_solicitacao_amostra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analise_id UUID NOT NULL REFERENCES public.produto_analise_embalagem(id) ON DELETE CASCADE,
  submissao_id UUID NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  numero_solicitacao TEXT NOT NULL,
  sku TEXT NOT NULL,
  data_solicitacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  sla_prazo DATE NOT NULL,
  instrucao_ajuste TEXT,
  cores_solicitadas JSONB DEFAULT '[]'::jsonb,
  qtd_amostras INTEGER DEFAULT 1,
  
  -- Resposta China
  fotos_china JSONB DEFAULT '[]'::jsonb,
  video_url TEXT,
  video_path TEXT,
  
  -- Avaliação Brasil
  numero_rodada INTEGER NOT NULL DEFAULT 1,
  avaliacao_resultado JSONB DEFAULT '[]'::jsonb,
  avaliacao_status TEXT DEFAULT 'aguardando_china' CHECK (avaliacao_status IN ('aguardando_china','evidencias_enviadas','em_avaliacao','conforme','nao_conforme','sla_vencido')),
  
  aprovado_por UUID,
  data_aprovacao TIMESTAMPTZ,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sequence para número de solicitação
CREATE SEQUENCE IF NOT EXISTS solicitacao_amostra_seq START 1;

-- RLS
ALTER TABLE public.produto_analise_embalagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_embalagem_cores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_solicitacao_amostra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage produto_analise_embalagem" ON public.produto_analise_embalagem FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage produto_embalagem_cores" ON public.produto_embalagem_cores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage produto_solicitacao_amostra" ON public.produto_solicitacao_amostra FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket for embalagem photos
INSERT INTO storage.buckets (id, name, public) VALUES ('embalagem-analise', 'embalagem-analise', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth users upload embalagem-analise" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'embalagem-analise');
CREATE POLICY "Auth users read embalagem-analise" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'embalagem-analise');
CREATE POLICY "Auth users delete embalagem-analise" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'embalagem-analise');
CREATE POLICY "Public read embalagem-analise" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'embalagem-analise');
