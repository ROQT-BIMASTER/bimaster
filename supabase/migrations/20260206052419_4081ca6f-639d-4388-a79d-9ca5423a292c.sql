
-- Fix: ampliar precisão dos campos percentuais para suportar valores > 999%
ALTER TABLE public.market_coverage_snapshot 
  ALTER COLUMN cobertura_percentual TYPE NUMERIC(10,2),
  ALTER COLUMN pipeline_percentual TYPE NUMERIC(10,2),
  ALTER COLUMN penetracao_percentual TYPE NUMERIC(10,2);

-- Recriar a função com cap de 9999% para segurança
CREATE OR REPLACE FUNCTION public.fn_calcular_cobertura_mercado()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.market_coverage_snapshot;

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
    CASE WHEN ibge.total_municipios > 0
      THEN ROUND((COALESCE(cli.municipios_com_clientes, 0)::NUMERIC / ibge.total_municipios) * 100, 2)
      ELSE 0
    END,
    CASE WHEN COALESCE(leads.total_leads, 0) > 0
      THEN LEAST(ROUND(((COALESCE(cli.total_clientes, 0) + COALESCE(prosp.total_prospects, 0))::NUMERIC / leads.total_leads) * 100, 2), 99999)
      ELSE 0
    END,
    CASE WHEN COALESCE(leads.total_leads, 0) > 0
      THEN LEAST(ROUND((COALESCE(prosp.total_prospects, 0)::NUMERIC / leads.total_leads) * 100, 2), 99999)
      ELSE 0
    END,
    COALESCE(ibge.populacao_total, 0),
    COALESCE(ibge.pib_total, 0),
    COALESCE(terr.vendedores, ARRAY[]::TEXT[]),
    now()
  FROM (
    SELECT uf_sigla, MIN(regiao_nome) AS regiao_nome,
      COUNT(*) AS total_municipios,
      SUM(COALESCE(populacao_estimada, 0)) AS populacao_total,
      SUM(COALESCE(pib_mil_reais, 0)) AS pib_total
    FROM public.ibge_municipios GROUP BY uf_sigla
  ) ibge
  LEFT JOIN (
    SELECT UPPER(TRIM(uf)) AS uf,
      COUNT(DISTINCT UPPER(TRIM(cidade))) AS municipios_com_clientes,
      COUNT(*) AS total_clientes
    FROM public.clientes WHERE uf IS NOT NULL AND TRIM(uf) <> ''
    GROUP BY UPPER(TRIM(uf))
  ) cli ON cli.uf = ibge.uf_sigla
  LEFT JOIN (
    SELECT UPPER(TRIM(uf)) AS uf,
      COUNT(DISTINCT UPPER(TRIM(municipio))) AS municipios_com_prospects,
      COUNT(*) AS total_prospects
    FROM public.prospects WHERE uf IS NOT NULL AND TRIM(uf) <> ''
    GROUP BY UPPER(TRIM(uf))
  ) prosp ON prosp.uf = ibge.uf_sigla
  LEFT JOIN (
    SELECT UPPER(TRIM(uf)) AS uf,
      COUNT(DISTINCT UPPER(TRIM(cidade))) AS municipios_com_leads,
      COUNT(*) AS total_leads
    FROM public.leads_minerados WHERE uf IS NOT NULL AND TRIM(uf) <> ''
    GROUP BY UPPER(TRIM(uf))
  ) leads ON leads.uf = ibge.uf_sigla
  LEFT JOIN (
    SELECT UPPER(TRIM(vt.uf)) AS uf,
      ARRAY_AGG(DISTINCT p.nome) AS vendedores
    FROM public.vendedor_territorios vt
    JOIN public.profiles p ON p.id = vt.vendedor_id
    WHERE vt.ativo = true GROUP BY UPPER(TRIM(vt.uf))
  ) terr ON terr.uf = ibge.uf_sigla;
END;
$$;
