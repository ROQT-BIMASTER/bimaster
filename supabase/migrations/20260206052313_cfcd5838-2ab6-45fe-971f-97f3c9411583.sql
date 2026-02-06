
-- =============================================
-- FASE 1: Tabela de Territórios de Vendedores
-- =============================================

CREATE TABLE public.vendedor_territorios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  uf TEXT NOT NULL,
  microrregiao_id INTEGER, -- referência ao ibge_municipios.microrregiao_id
  microrregiao_nome TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(vendedor_id, uf, microrregiao_id)
);

-- Enable RLS
ALTER TABLE public.vendedor_territorios ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view territories"
  ON public.vendedor_territorios FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and managers can insert territories"
  ON public.vendedor_territorios FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and managers can update territories"
  ON public.vendedor_territorios FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and managers can delete territories"
  ON public.vendedor_territorios FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- =============================================
-- FASE 1: Tabela de Snapshot de Cobertura
-- =============================================

CREATE TABLE public.market_coverage_snapshot (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uf TEXT NOT NULL,
  regiao_nome TEXT,
  total_municipios INTEGER NOT NULL DEFAULT 0,
  municipios_com_clientes INTEGER NOT NULL DEFAULT 0,
  municipios_com_prospects INTEGER NOT NULL DEFAULT 0,
  municipios_com_leads INTEGER NOT NULL DEFAULT 0,
  total_clientes_erp INTEGER NOT NULL DEFAULT 0,
  total_prospects INTEGER NOT NULL DEFAULT 0,
  total_leads_minerados INTEGER NOT NULL DEFAULT 0,
  penetracao_percentual NUMERIC(5,2) NOT NULL DEFAULT 0,
  cobertura_percentual NUMERIC(5,2) NOT NULL DEFAULT 0,
  pipeline_percentual NUMERIC(5,2) NOT NULL DEFAULT 0,
  populacao_total BIGINT NOT NULL DEFAULT 0,
  pib_total_mil_reais NUMERIC NOT NULL DEFAULT 0,
  vendedores_atribuidos TEXT[], -- array de nomes dos vendedores
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(uf)
);

-- Enable RLS
ALTER TABLE public.market_coverage_snapshot ENABLE ROW LEVEL SECURITY;

-- Policies - read-only for authenticated users
CREATE POLICY "Authenticated users can view coverage snapshots"
  ON public.market_coverage_snapshot FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only the function (service role) will write, but allow authenticated for manual refresh
CREATE POLICY "Authenticated users can manage coverage snapshots"
  ON public.market_coverage_snapshot FOR ALL
  USING (auth.uid() IS NOT NULL);

-- =============================================
-- FASE 2: Função de Cálculo de Cobertura
-- =============================================

CREATE OR REPLACE FUNCTION public.fn_calcular_cobertura_mercado()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Limpar snapshot existente
  DELETE FROM public.market_coverage_snapshot;

  -- Inserir dados calculados cruzando todas as fontes
  INSERT INTO public.market_coverage_snapshot (
    uf, regiao_nome, total_municipios,
    municipios_com_clientes, municipios_com_prospects, municipios_com_leads,
    total_clientes_erp, total_prospects, total_leads_minerados,
    penetracao_percentual, cobertura_percentual, pipeline_percentual,
    populacao_total, pib_total_mil_reais,
    vendedores_atribuidos, updated_at
  )
  SELECT
    ibge.uf_sigla AS uf,
    ibge.regiao_nome,
    ibge.total_municipios,
    COALESCE(cli.municipios_com_clientes, 0),
    COALESCE(prosp.municipios_com_prospects, 0),
    COALESCE(leads.municipios_com_leads, 0),
    COALESCE(cli.total_clientes, 0),
    COALESCE(prosp.total_prospects, 0),
    COALESCE(leads.total_leads, 0),
    -- Penetração: municípios com clientes / total municípios
    CASE WHEN ibge.total_municipios > 0
      THEN ROUND((COALESCE(cli.municipios_com_clientes, 0)::NUMERIC / ibge.total_municipios) * 100, 2)
      ELSE 0
    END AS penetracao_percentual,
    -- Cobertura: (clientes + prospects) / leads minerados
    CASE WHEN COALESCE(leads.total_leads, 0) > 0
      THEN ROUND(((COALESCE(cli.total_clientes, 0) + COALESCE(prosp.total_prospects, 0))::NUMERIC / leads.total_leads) * 100, 2)
      ELSE 0
    END AS cobertura_percentual,
    -- Pipeline: prospects / leads minerados
    CASE WHEN COALESCE(leads.total_leads, 0) > 0
      THEN ROUND((COALESCE(prosp.total_prospects, 0)::NUMERIC / leads.total_leads) * 100, 2)
      ELSE 0
    END AS pipeline_percentual,
    COALESCE(ibge.populacao_total, 0),
    COALESCE(ibge.pib_total, 0),
    COALESCE(terr.vendedores, ARRAY[]::TEXT[]),
    now()
  FROM (
    -- Agregação IBGE por UF
    SELECT
      uf_sigla,
      MIN(regiao_nome) AS regiao_nome,
      COUNT(*) AS total_municipios,
      SUM(COALESCE(populacao_estimada, 0)) AS populacao_total,
      SUM(COALESCE(pib_mil_reais, 0)) AS pib_total
    FROM public.ibge_municipios
    GROUP BY uf_sigla
  ) ibge
  LEFT JOIN (
    -- Clientes ERP agrupados por UF
    SELECT
      UPPER(TRIM(uf)) AS uf,
      COUNT(DISTINCT UPPER(TRIM(cidade))) AS municipios_com_clientes,
      COUNT(*) AS total_clientes
    FROM public.clientes
    WHERE uf IS NOT NULL AND TRIM(uf) <> ''
    GROUP BY UPPER(TRIM(uf))
  ) cli ON cli.uf = ibge.uf_sigla
  LEFT JOIN (
    -- Prospects agrupados por UF
    SELECT
      UPPER(TRIM(uf)) AS uf,
      COUNT(DISTINCT UPPER(TRIM(municipio))) AS municipios_com_prospects,
      COUNT(*) AS total_prospects
    FROM public.prospects
    WHERE uf IS NOT NULL AND TRIM(uf) <> ''
    GROUP BY UPPER(TRIM(uf))
  ) prosp ON prosp.uf = ibge.uf_sigla
  LEFT JOIN (
    -- Leads minerados agrupados por UF
    SELECT
      UPPER(TRIM(uf)) AS uf,
      COUNT(DISTINCT UPPER(TRIM(cidade))) AS municipios_com_leads,
      COUNT(*) AS total_leads
    FROM public.leads_minerados
    WHERE uf IS NOT NULL AND TRIM(uf) <> ''
    GROUP BY UPPER(TRIM(uf))
  ) leads ON leads.uf = ibge.uf_sigla
  LEFT JOIN (
    -- Vendedores por território
    SELECT
      UPPER(TRIM(vt.uf)) AS uf,
      ARRAY_AGG(DISTINCT p.nome) AS vendedores
    FROM public.vendedor_territorios vt
    JOIN public.profiles p ON p.id = vt.vendedor_id
    WHERE vt.ativo = true
    GROUP BY UPPER(TRIM(vt.uf))
  ) terr ON terr.uf = ibge.uf_sigla;

END;
$$;

-- =============================================
-- FASE 4: Função para Atribuir Vendedor por Território
-- =============================================

CREATE OR REPLACE FUNCTION public.fn_atribuir_vendedor_territorio(p_cidade TEXT, p_uf TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendedor_id UUID;
  v_uf TEXT := UPPER(TRIM(p_uf));
BEGIN
  -- Primeiro tenta encontrar vendedor por microrregião (mais específico)
  SELECT vt.vendedor_id INTO v_vendedor_id
  FROM public.vendedor_territorios vt
  JOIN public.ibge_municipios im ON im.microrregiao_id = vt.microrregiao_id
  WHERE UPPER(TRIM(im.uf_sigla)) = v_uf
    AND UPPER(TRIM(im.nome)) = UPPER(TRIM(p_cidade))
    AND vt.ativo = true
  LIMIT 1;

  -- Se não encontrou por microrregião, busca por UF
  IF v_vendedor_id IS NULL THEN
    SELECT vt.vendedor_id INTO v_vendedor_id
    FROM public.vendedor_territorios vt
    WHERE UPPER(TRIM(vt.uf)) = v_uf
      AND vt.microrregiao_id IS NULL
      AND vt.ativo = true
    LIMIT 1;
  END IF;

  RETURN v_vendedor_id;
END;
$$;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_vendedor_territorios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_vendedor_territorios_updated_at
  BEFORE UPDATE ON public.vendedor_territorios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_vendedor_territorios_updated_at();
