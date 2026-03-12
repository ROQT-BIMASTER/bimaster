
-- 1. Expand produtos_brasil with full product fields
ALTER TABLE public.produtos_brasil
  ADD COLUMN IF NOT EXISTS ncm text,
  ADD COLUMN IF NOT EXISTS ean_unitario text,
  ADD COLUMN IF NOT EXISTS ean_display text,
  ADD COLUMN IF NOT EXISTS ean_caixa_master text,
  ADD COLUMN IF NOT EXISTS tipo_produto text DEFAULT 'ACABADO',
  ADD COLUMN IF NOT EXISTS marca text,
  ADD COLUMN IF NOT EXISTS linha text,
  ADD COLUMN IF NOT EXISTS fabricante text,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS foto_url text,
  ADD COLUMN IF NOT EXISTS origem text DEFAULT 'importado',
  ADD COLUMN IF NOT EXISTS data_inicio_processo timestamptz,
  ADD COLUMN IF NOT EXISTS data_previsao_chegada timestamptz,
  ADD COLUMN IF NOT EXISTS data_cadastro_finalizado timestamptz,
  ADD COLUMN IF NOT EXISTS processo_anvisa text,
  ADD COLUMN IF NOT EXISTS nome_comercial text,
  ADD COLUMN IF NOT EXISTS descricao_curta text,
  ADD COLUMN IF NOT EXISTS descricao_completa text,
  ADD COLUMN IF NOT EXISTS custo_unitario_china numeric,
  ADD COLUMN IF NOT EXISTS itens_display integer,
  ADD COLUMN IF NOT EXISTS peso_bruto numeric,
  ADD COLUMN IF NOT EXISTS peso_liquido numeric;

-- 2. Create produtos_brasil_custos (mirrors fabrica_custos_config)
CREATE TABLE IF NOT EXISTS public.produtos_brasil_custos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_brasil_id uuid NOT NULL REFERENCES public.produtos_brasil(id) ON DELETE CASCADE,
  custo_nf numeric(12,4) DEFAULT 0,
  custo_servico numeric(12,4) DEFAULT 0,
  custo_condicao numeric(12,4) DEFAULT 0,
  custo_base_tipo text DEFAULT 'nf_servico',
  markup_tipo text DEFAULT 'percentual',
  markup_valor numeric(12,4) DEFAULT 0,
  impostos_percentual numeric(8,4) DEFAULT 0,
  frete_valor numeric(12,4) DEFAULT 0,
  margem_contribuicao numeric(8,4) DEFAULT 0,
  preco_sugerido numeric(12,4) DEFAULT 0,
  status text DEFAULT 'rascunho',
  aprovado_por uuid,
  aprovado_em timestamptz,
  observacoes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(produto_brasil_id)
);

ALTER TABLE public.produtos_brasil_custos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view produtos_brasil_custos"
  ON public.produtos_brasil_custos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert produtos_brasil_custos"
  ON public.produtos_brasil_custos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update produtos_brasil_custos"
  ON public.produtos_brasil_custos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete produtos_brasil_custos"
  ON public.produtos_brasil_custos FOR DELETE TO authenticated USING (true);

-- 3. Create produtos_brasil_precos (mirrors fabrica_precos_produtos)
CREATE TABLE IF NOT EXISTS public.produtos_brasil_precos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_brasil_id uuid NOT NULL REFERENCES public.produtos_brasil(id) ON DELETE CASCADE,
  tabela_id uuid REFERENCES public.fabrica_tabelas_preco(id) ON DELETE CASCADE,
  preco_calculado numeric(12,4) DEFAULT 0,
  preco_final numeric(12,4) DEFAULT 0,
  markup_aplicado numeric(12,4) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(produto_brasil_id, tabela_id)
);

ALTER TABLE public.produtos_brasil_precos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view produtos_brasil_precos"
  ON public.produtos_brasil_precos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert produtos_brasil_precos"
  ON public.produtos_brasil_precos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update produtos_brasil_precos"
  ON public.produtos_brasil_precos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete produtos_brasil_precos"
  ON public.produtos_brasil_precos FOR DELETE TO authenticated USING (true);
