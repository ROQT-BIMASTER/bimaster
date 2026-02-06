
-- =============================================
-- IBGE Integration Tables
-- =============================================

-- 1. ibge_estados - 27 states
CREATE TABLE public.ibge_estados (
  id integer PRIMARY KEY,
  sigla text NOT NULL,
  nome text NOT NULL,
  regiao_id integer,
  regiao_sigla text,
  regiao_nome text,
  populacao bigint,
  pib_mil_reais numeric,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ibge_estados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ibge_estados"
  ON public.ibge_estados FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage ibge_estados"
  ON public.ibge_estados FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. ibge_microrregioes - ~558 micro-regions
CREATE TABLE public.ibge_microrregioes (
  id integer PRIMARY KEY,
  nome text NOT NULL,
  mesorregiao_id integer,
  mesorregiao_nome text,
  uf_id integer REFERENCES public.ibge_estados(id),
  regiao_nome text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ibge_microrregioes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ibge_microrregioes"
  ON public.ibge_microrregioes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage ibge_microrregioes"
  ON public.ibge_microrregioes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. ibge_municipios - ~5570 municipalities
CREATE TABLE public.ibge_municipios (
  id integer PRIMARY KEY,
  nome text NOT NULL,
  uf_id integer REFERENCES public.ibge_estados(id),
  uf_sigla text,
  microrregiao_id integer REFERENCES public.ibge_microrregioes(id),
  microrregiao_nome text,
  mesorregiao_id integer,
  mesorregiao_nome text,
  regiao_nome text,
  populacao_estimada bigint,
  pib_mil_reais numeric,
  pib_per_capita numeric,
  ano_populacao integer,
  ano_pib integer,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ibge_municipios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ibge_municipios"
  ON public.ibge_municipios FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage ibge_municipios"
  ON public.ibge_municipios FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_ibge_municipios_uf ON public.ibge_municipios(uf_id);
CREATE INDEX idx_ibge_municipios_microrregiao ON public.ibge_municipios(microrregiao_id);
CREATE INDEX idx_ibge_municipios_regiao ON public.ibge_municipios(regiao_nome);
CREATE INDEX idx_ibge_municipios_nome ON public.ibge_municipios(nome);
CREATE INDEX idx_ibge_microrregioes_uf ON public.ibge_microrregioes(uf_id);
