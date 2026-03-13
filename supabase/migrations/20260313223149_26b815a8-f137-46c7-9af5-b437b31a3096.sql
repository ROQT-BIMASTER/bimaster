
-- Tabela principal: Checklist Etiqueta/Bula
CREATE TABLE public.produto_etiqueta_bula (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id UUID REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  produto_nome TEXT NOT NULL,
  linha_marca TEXT,
  double_sticker BOOLEAN DEFAULT false,
  
  -- Finishing / Colors
  finishing TEXT DEFAULT 'shiny',
  colors TEXT DEFAULT 'product_color',
  
  -- Arquivos
  arte_etiqueta_urls JSONB DEFAULT '[]'::jsonb,
  faca_url TEXT,
  fotos_referencia JSONB DEFAULT '[]'::jsonb,
  arte_final_url TEXT,
  data_af_recebida TIMESTAMPTZ,
  
  -- Fluxo sequencial
  etapa_atual TEXT NOT NULL DEFAULT 'criacao' CHECK (etapa_atual IN ('criacao','embalagem','desenvolvimento','regulatorio','af_recebida')),
  status_atual TEXT NOT NULL DEFAULT 'rascunho' CHECK (status_atual IN ('rascunho','aguardando_embalagem','aguardando_desenvolvimento','aguardando_regulatorio','aguardando_af','concluido','reprovado')),
  numero_rodada INTEGER NOT NULL DEFAULT 1,
  
  -- Aprovações por departamento (JSON array)
  aprovacoes JSONB DEFAULT '[]'::jsonb,
  -- Histórico completo de transições
  historico_completo JSONB DEFAULT '[]'::jsonb,
  
  -- Checklist Regulatório (7 itens)
  regulatorio_checklist JSONB DEFAULT '[]'::jsonb,
  
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de cores da etiqueta
CREATE TABLE public.produto_etiqueta_cores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etiqueta_id UUID NOT NULL REFERENCES public.produto_etiqueta_bula(id) ON DELETE CASCADE,
  codigo_cor TEXT NOT NULL,
  pantone_ref TEXT,
  cor_hex TEXT,
  swatch_url TEXT,
  arte_url TEXT,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.produto_etiqueta_bula ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_etiqueta_cores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage produto_etiqueta_bula" ON public.produto_etiqueta_bula FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage produto_etiqueta_cores" ON public.produto_etiqueta_cores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('etiqueta-bula', 'etiqueta-bula', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth users upload etiqueta-bula" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'etiqueta-bula');
CREATE POLICY "Auth users read etiqueta-bula" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'etiqueta-bula');
CREATE POLICY "Auth users delete etiqueta-bula" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'etiqueta-bula');
CREATE POLICY "Public read etiqueta-bula" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'etiqueta-bula');
