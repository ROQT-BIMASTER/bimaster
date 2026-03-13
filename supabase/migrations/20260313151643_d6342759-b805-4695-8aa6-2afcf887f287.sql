
-- Phase 1: Add new product lifecycle statuses to produtos_brasil
-- (status is a text field, no enum to alter — just need to support new values in code)

-- Phase 2: Add project wizard fields to projetos table
ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS marca text,
  ADD COLUMN IF NOT EXISTS categoria_linha text,
  ADD COLUMN IF NOT EXISTS origem_projeto text DEFAULT 'brasil';

-- Phase 3: Create produto_testes table for samples/testing module
CREATE TABLE IF NOT EXISTS public.produto_testes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_brasil_id uuid NOT NULL REFERENCES public.produtos_brasil(id) ON DELETE CASCADE,
  tipo_teste text NOT NULL DEFAULT 'cor',
  status text NOT NULL DEFAULT 'amostra_solicitada',
  responsavel_id uuid,
  resultado text,
  fotos text[] DEFAULT '{}',
  lote text,
  fornecedor text,
  data_solicitacao timestamptz DEFAULT now(),
  data_recebimento timestamptz,
  data_resultado timestamptz,
  observacoes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.produto_testes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view produto_testes"
  ON public.produto_testes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert produto_testes"
  ON public.produto_testes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update produto_testes"
  ON public.produto_testes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete produto_testes"
  ON public.produto_testes FOR DELETE TO authenticated USING (true);

-- Phase 4: Add packaging-specific fields to produtos_brasil
ALTER TABLE public.produtos_brasil
  ADD COLUMN IF NOT EXISTS modo_uso text,
  ADD COLUMN IF NOT EXISTS precaucoes text,
  ADD COLUMN IF NOT EXISTS ativos text,
  ADD COLUMN IF NOT EXISTS fragrancia text,
  ADD COLUMN IF NOT EXISTS tipo_aplicador text,
  ADD COLUMN IF NOT EXISTS composicao text;

-- Phase 5: Expand ANVISA regulatory fields on produtos_brasil
ALTER TABLE public.produtos_brasil
  ADD COLUMN IF NOT EXISTS anvisa_data_envio date,
  ADD COLUMN IF NOT EXISTS anvisa_data_aprovacao date,
  ADD COLUMN IF NOT EXISTS anvisa_taxa_paga boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS anvisa_observacoes text,
  ADD COLUMN IF NOT EXISTS anvisa_pipeline_status text DEFAULT 'analise_regulatoria';

-- Phase 6: Create produto_aprovacoes_fisicas and produto_rnc tables
CREATE TABLE IF NOT EXISTS public.produto_aprovacoes_fisicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_brasil_id uuid NOT NULL REFERENCES public.produtos_brasil(id) ON DELETE CASCADE,
  cor_conforme boolean,
  textura_conforme boolean,
  fragrancia_conforme boolean,
  rotulagem_conforme boolean,
  peso_conforme boolean,
  resultado text DEFAULT 'pendente',
  avaliado_por uuid,
  avaliado_em timestamptz,
  observacoes text,
  fotos text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.produto_aprovacoes_fisicas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can view aprovacoes_fisicas"
  ON public.produto_aprovacoes_fisicas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert aprovacoes_fisicas"
  ON public.produto_aprovacoes_fisicas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update aprovacoes_fisicas"
  ON public.produto_aprovacoes_fisicas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.produto_rnc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_brasil_id uuid NOT NULL REFERENCES public.produtos_brasil(id) ON DELETE CASCADE,
  aprovacao_fisica_id uuid REFERENCES public.produto_aprovacoes_fisicas(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  tipo_nao_conformidade text NOT NULL,
  acao_corretiva text,
  prazo_correcao date,
  fornecedor_notificado boolean DEFAULT false,
  fornecedor_nome text,
  fotos text[] DEFAULT '{}',
  status text DEFAULT 'aberta',
  resolvida_em timestamptz,
  resolvida_por uuid,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.produto_rnc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can view produto_rnc"
  ON public.produto_rnc FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert produto_rnc"
  ON public.produto_rnc FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update produto_rnc"
  ON public.produto_rnc FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
