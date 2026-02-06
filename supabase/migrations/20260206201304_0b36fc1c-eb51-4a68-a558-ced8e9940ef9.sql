
-- ================================================
-- Etapa 1: Extensão unaccent + novas colunas
-- ================================================
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA public;

ALTER TABLE clientes 
  ADD COLUMN IF NOT EXISTS ibge_municipio_id integer,
  ADD COLUMN IF NOT EXISTS cidade_normalizada text;

CREATE INDEX IF NOT EXISTS idx_clientes_ibge_municipio ON clientes(ibge_municipio_id);
CREATE INDEX IF NOT EXISTS idx_clientes_cnpj_len ON clientes((LENGTH(TRIM(COALESCE(cnpj,'')))));

-- ================================================
-- Etapa 2: Função de normalização em lote
-- ================================================
CREATE OR REPLACE FUNCTION fn_normalizar_municipios_clientes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_processados integer;
  v_total_normalizados integer;
  v_total_sem_match integer;
  v_cidades_sem_match jsonb;
BEGIN
  -- Reset previous normalizations to re-run fresh
  UPDATE clientes SET ibge_municipio_id = NULL, cidade_normalizada = NULL
  WHERE ibge_municipio_id IS NOT NULL OR cidade_normalizada IS NOT NULL;

  -- Step 1: Direct match via unaccent (handles accents + case)
  UPDATE clientes c
  SET 
    ibge_municipio_id = m.id,
    cidade_normalizada = m.nome
  FROM ibge_municipios m
  WHERE c.cnpj IS NOT NULL 
    AND LENGTH(TRIM(c.cnpj)) = 14
    AND c.cidade IS NOT NULL AND TRIM(c.cidade) <> ''
    AND c.uf IS NOT NULL AND TRIM(c.uf) <> ''
    AND UPPER(public.unaccent(TRIM(c.cidade))) = UPPER(public.unaccent(TRIM(m.nome)))
    AND UPPER(TRIM(c.uf)) = m.uf_sigla;

  -- Step 2: Special case for DF (only 1 municipality: Brasília)
  -- Any unmatched DF client maps to Brasília
  UPDATE clientes c
  SET 
    ibge_municipio_id = m.id,
    cidade_normalizada = m.nome
  FROM ibge_municipios m
  WHERE c.cnpj IS NOT NULL 
    AND LENGTH(TRIM(c.cnpj)) = 14
    AND UPPER(TRIM(c.uf)) = 'DF'
    AND m.uf_sigla = 'DF'
    AND c.ibge_municipio_id IS NULL;

  -- Step 3: Try substring match for remaining (e.g. "SAO PAULO - CENTRO" -> "São Paulo")
  UPDATE clientes c
  SET 
    ibge_municipio_id = best.id,
    cidade_normalizada = best.nome
  FROM (
    SELECT DISTINCT ON (c2.id) c2.id AS cliente_id, m2.id, m2.nome
    FROM clientes c2
    JOIN ibge_municipios m2 ON m2.uf_sigla = UPPER(TRIM(c2.uf))
    WHERE c2.cnpj IS NOT NULL 
      AND LENGTH(TRIM(c2.cnpj)) = 14
      AND c2.ibge_municipio_id IS NULL
      AND c2.cidade IS NOT NULL AND TRIM(c2.cidade) <> ''
      AND c2.uf IS NOT NULL AND TRIM(c2.uf) <> ''
      AND (
        UPPER(public.unaccent(TRIM(c2.cidade))) LIKE UPPER(public.unaccent(TRIM(m2.nome))) || '%'
        OR UPPER(public.unaccent(TRIM(m2.nome))) LIKE UPPER(public.unaccent(TRIM(c2.cidade))) || '%'
      )
    ORDER BY c2.id, LENGTH(m2.nome) DESC
  ) best
  WHERE c.id = best.cliente_id
    AND c.ibge_municipio_id IS NULL;

  -- Compute statistics
  SELECT COUNT(*) INTO v_total_processados
  FROM clientes 
  WHERE cnpj IS NOT NULL AND LENGTH(TRIM(cnpj)) = 14
    AND cidade IS NOT NULL AND TRIM(cidade) <> ''
    AND uf IS NOT NULL AND TRIM(uf) <> '';

  SELECT COUNT(*) INTO v_total_normalizados
  FROM clientes 
  WHERE cnpj IS NOT NULL AND LENGTH(TRIM(cnpj)) = 14
    AND ibge_municipio_id IS NOT NULL;

  v_total_sem_match := v_total_processados - v_total_normalizados;

  -- Get unmatched cities grouped by UF (top 200)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'uf', sub.uf,
    'cidade', sub.cidade,
    'quantidade', sub.qtd
  )), '[]'::jsonb) INTO v_cidades_sem_match
  FROM (
    SELECT UPPER(TRIM(uf)) AS uf, UPPER(TRIM(cidade)) AS cidade, COUNT(*) AS qtd
    FROM clientes
    WHERE cnpj IS NOT NULL AND LENGTH(TRIM(cnpj)) = 14
      AND cidade IS NOT NULL AND TRIM(cidade) <> ''
      AND uf IS NOT NULL AND TRIM(uf) <> ''
      AND ibge_municipio_id IS NULL
    GROUP BY UPPER(TRIM(uf)), UPPER(TRIM(cidade))
    ORDER BY COUNT(*) DESC
    LIMIT 200
  ) sub;

  RETURN jsonb_build_object(
    'total_processados', v_total_processados,
    'normalizados', v_total_normalizados,
    'sem_match', v_total_sem_match,
    'pct_sucesso', CASE WHEN v_total_processados > 0 
      THEN ROUND((v_total_normalizados::numeric / v_total_processados) * 100, 2) 
      ELSE 0 END,
    'cidades_sem_match', v_cidades_sem_match
  );
END;
$$;

-- ================================================
-- Etapa 3: Atualizar fn_calcular_cobertura_mercado
-- Usar ibge_municipio_id + filtro CNPJ
-- ================================================
CREATE OR REPLACE FUNCTION fn_calcular_cobertura_mercado()
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
      COUNT(DISTINCT ibge_municipio_id) AS municipios_com_clientes,
      COUNT(*) AS total_clientes
    FROM public.clientes 
    WHERE uf IS NOT NULL AND TRIM(uf) <> ''
      AND cnpj IS NOT NULL AND LENGTH(TRIM(cnpj)) = 14
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

-- ================================================
-- Etapa 3b: Atualizar get_portfolio_kpis com filtro CNPJ
-- ================================================
CREATE OR REPLACE FUNCTION get_portfolio_kpis(p_empresa_id integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH base AS (
    SELECT
      c.id,
      c.uf,
      c.cidade,
      c.valor_ultima_compra,
      c.valor_maior_compra,
      c.limite_credito,
      c.data_ultima_compra,
      c.data_cadastro,
      CASE WHEN c.valor_ultima_compra > 0 THEN true ELSE false END AS tem_compra
    FROM clientes c
    WHERE (p_empresa_id IS NULL OR c.empresa_id = p_empresa_id)
      AND c.cnpj IS NOT NULL AND LENGTH(TRIM(c.cnpj)) = 14
  ),
  kpi_calc AS (
    SELECT
      COUNT(*) AS total_clientes,
      COUNT(*) FILTER (WHERE tem_compra) AS clientes_com_compra,
      COUNT(*) FILTER (WHERE NOT tem_compra) AS clientes_sem_compra,
      COALESCE(SUM(valor_ultima_compra) FILTER (WHERE tem_compra), 0) AS total_receita_ultima,
      COALESCE(SUM(valor_maior_compra) FILTER (WHERE tem_compra), 0) AS total_receita_maior,
      COALESCE(SUM(limite_credito), 0) AS limite_total,
      COUNT(*) FILTER (WHERE tem_compra AND data_ultima_compra >= CURRENT_DATE - INTERVAL '90 days') AS ativos,
      COUNT(*) FILTER (WHERE tem_compra AND data_ultima_compra < CURRENT_DATE - INTERVAL '90 days' AND data_ultima_compra >= CURRENT_DATE - INTERVAL '365 days') AS em_risco,
      COUNT(*) FILTER (WHERE tem_compra AND data_ultima_compra < CURRENT_DATE - INTERVAL '365 days') AS inativos
    FROM base
  )
  SELECT jsonb_build_object(
    'totalClientes', total_clientes,
    'clientesComCompra', clientes_com_compra,
    'clientesSemCompra', clientes_sem_compra,
    'taxaConversao', CASE WHEN total_clientes > 0 THEN ROUND((clientes_com_compra::numeric / total_clientes) * 100, 2) ELSE 0 END,
    'ticketMedio', CASE WHEN clientes_com_compra > 0 THEN ROUND(total_receita_ultima / clientes_com_compra, 2) ELSE 0 END,
    'ticketMaiorMedio', CASE WHEN clientes_com_compra > 0 THEN ROUND(total_receita_maior / clientes_com_compra, 2) ELSE 0 END,
    'totalReceitaUltima', total_receita_ultima,
    'limiteTotal', limite_total,
    'limiteUtilizacaoPct', CASE WHEN limite_total > 0 THEN ROUND((total_receita_ultima / limite_total) * 100, 2) ELSE 0 END,
    'ativos', ativos,
    'emRisco', em_risco,
    'inativos', inativos
  ) INTO result
  FROM kpi_calc;

  RETURN result;
END;
$$;

-- ================================================
-- Etapa 3c: Atualizar get_concentracao_uf com filtro CNPJ
-- ================================================
CREATE OR REPLACE FUNCTION get_concentracao_uf(p_empresa_id integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  total_receita numeric;
  total_count bigint;
BEGIN
  SELECT 
    COALESCE(SUM(valor_ultima_compra) FILTER (WHERE valor_ultima_compra > 0), 0),
    COUNT(*)
  INTO total_receita, total_count
  FROM clientes
  WHERE (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
    AND cnpj IS NOT NULL AND LENGTH(TRIM(cnpj)) = 14;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY receita_ultima DESC), '[]'::jsonb) INTO result
  FROM (
    SELECT jsonb_build_object(
      'uf', COALESCE(uf, 'N/D'),
      'totalClientes', COUNT(*),
      'clientesComCompra', COUNT(*) FILTER (WHERE valor_ultima_compra > 0),
      'receitaUltima', COALESCE(SUM(valor_ultima_compra) FILTER (WHERE valor_ultima_compra > 0), 0),
      'receitaMaior', COALESCE(SUM(valor_maior_compra) FILTER (WHERE valor_ultima_compra > 0), 0),
      'limiteCredito', COALESCE(SUM(limite_credito), 0),
      'ticketMedio', CASE WHEN COUNT(*) FILTER (WHERE valor_ultima_compra > 0) > 0
        THEN ROUND(COALESCE(SUM(valor_ultima_compra) FILTER (WHERE valor_ultima_compra > 0), 0) / COUNT(*) FILTER (WHERE valor_ultima_compra > 0), 2)
        ELSE 0 END,
      'pctReceita', CASE WHEN total_receita > 0
        THEN ROUND((COALESCE(SUM(valor_ultima_compra) FILTER (WHERE valor_ultima_compra > 0), 0) / total_receita) * 100, 2)
        ELSE 0 END,
      'pctClientes', CASE WHEN total_count > 0
        THEN ROUND((COUNT(*)::numeric / total_count) * 100, 2)
        ELSE 0 END
    ) AS row_data,
    COALESCE(SUM(valor_ultima_compra) FILTER (WHERE valor_ultima_compra > 0), 0) AS receita_ultima
    FROM clientes
    WHERE (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
      AND cnpj IS NOT NULL AND LENGTH(TRIM(cnpj)) = 14
    GROUP BY COALESCE(uf, 'N/D')
  ) sub;

  RETURN result;
END;
$$;

-- ================================================
-- Etapa 3d: Atualizar get_faixas_ticket com filtro CNPJ
-- ================================================
CREATE OR REPLACE FUNCTION get_faixas_ticket(p_empresa_id integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  total_com_compra bigint;
BEGIN
  SELECT COUNT(*) INTO total_com_compra
  FROM clientes
  WHERE valor_ultima_compra > 0
    AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
    AND cnpj IS NOT NULL AND LENGTH(TRIM(cnpj)) = 14;

  SELECT jsonb_agg(jsonb_build_object(
    'faixa', faixa,
    'min', fmin,
    'max', fmax,
    'quantidade', qtd,
    'valorTotal', val_total,
    'pctClientes', CASE WHEN total_com_compra > 0 THEN ROUND((qtd::numeric / total_com_compra) * 100, 2) ELSE 0 END
  ) ORDER BY fmin) INTO result
  FROM (
    SELECT 'Micro (< R$ 100)' AS faixa, 0 AS fmin, 100 AS fmax,
      COUNT(*) AS qtd, COALESCE(SUM(valor_ultima_compra), 0) AS val_total
    FROM clientes WHERE valor_ultima_compra > 0 AND valor_ultima_compra < 100 AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id) AND cnpj IS NOT NULL AND LENGTH(TRIM(cnpj)) = 14
    UNION ALL
    SELECT 'Pequeno (R$ 100-500)', 100, 500,
      COUNT(*), COALESCE(SUM(valor_ultima_compra), 0)
    FROM clientes WHERE valor_ultima_compra >= 100 AND valor_ultima_compra < 500 AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id) AND cnpj IS NOT NULL AND LENGTH(TRIM(cnpj)) = 14
    UNION ALL
    SELECT 'Médio (R$ 500-2k)', 500, 2000,
      COUNT(*), COALESCE(SUM(valor_ultima_compra), 0)
    FROM clientes WHERE valor_ultima_compra >= 500 AND valor_ultima_compra < 2000 AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id) AND cnpj IS NOT NULL AND LENGTH(TRIM(cnpj)) = 14
    UNION ALL
    SELECT 'Alto (R$ 2k-5k)', 2000, 5000,
      COUNT(*), COALESCE(SUM(valor_ultima_compra), 0)
    FROM clientes WHERE valor_ultima_compra >= 2000 AND valor_ultima_compra < 5000 AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id) AND cnpj IS NOT NULL AND LENGTH(TRIM(cnpj)) = 14
    UNION ALL
    SELECT 'Premium (R$ 5k-20k)', 5000, 20000,
      COUNT(*), COALESCE(SUM(valor_ultima_compra), 0)
    FROM clientes WHERE valor_ultima_compra >= 5000 AND valor_ultima_compra < 20000 AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id) AND cnpj IS NOT NULL AND LENGTH(TRIM(cnpj)) = 14
    UNION ALL
    SELECT 'Enterprise (> R$ 20k)', 20000, 999999999,
      COUNT(*), COALESCE(SUM(valor_ultima_compra), 0)
    FROM clientes WHERE valor_ultima_compra >= 20000 AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id) AND cnpj IS NOT NULL AND LENGTH(TRIM(cnpj)) = 14
  ) faixas;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- ================================================
-- Etapa 3e: Atualizar get_potencial_uf com filtro CNPJ
-- ================================================
CREATE OR REPLACE FUNCTION get_potencial_uf(p_empresa_id integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_data ORDER BY sem_compra DESC), '[]'::jsonb) INTO result
  FROM (
    SELECT jsonb_build_object(
      'uf', COALESCE(uf, 'N/D'),
      'cadastrados', COUNT(*),
      'semCompra', COUNT(*) FILTER (WHERE valor_ultima_compra IS NULL OR valor_ultima_compra <= 0),
      'taxaInatividade', CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE valor_ultima_compra IS NULL OR valor_ultima_compra <= 0)::numeric / COUNT(*)) * 100, 2)
        ELSE 0 END,
      'limiteDisponivel', COALESCE(SUM(limite_credito), 0) - COALESCE(SUM(valor_ultima_compra) FILTER (WHERE valor_ultima_compra > 0), 0)
    ) AS row_data,
    COUNT(*) FILTER (WHERE valor_ultima_compra IS NULL OR valor_ultima_compra <= 0) AS sem_compra
    FROM clientes
    WHERE (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
      AND cnpj IS NOT NULL AND LENGTH(TRIM(cnpj)) = 14
    GROUP BY COALESCE(uf, 'N/D')
    HAVING COUNT(*) FILTER (WHERE valor_ultima_compra IS NULL OR valor_ultima_compra <= 0) > 0
  ) sub;

  RETURN result;
END;
$$;
