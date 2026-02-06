
-- RPC: Portfolio KPIs (replaces client-side useClienteAnalytics heavy processing)
CREATE OR REPLACE FUNCTION public.get_portfolio_kpis(p_empresa_id integer DEFAULT NULL)
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

-- RPC: Concentração por UF
CREATE OR REPLACE FUNCTION public.get_concentracao_uf(p_empresa_id integer DEFAULT NULL)
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
  WHERE (p_empresa_id IS NULL OR empresa_id = p_empresa_id);

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
    GROUP BY COALESCE(uf, 'N/D')
  ) sub;

  RETURN result;
END;
$$;

-- RPC: Faixas de Ticket
CREATE OR REPLACE FUNCTION public.get_faixas_ticket(p_empresa_id integer DEFAULT NULL)
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
    AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id);

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
    FROM clientes WHERE valor_ultima_compra > 0 AND valor_ultima_compra < 100 AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
    UNION ALL
    SELECT 'Pequeno (R$ 100-500)', 100, 500,
      COUNT(*), COALESCE(SUM(valor_ultima_compra), 0)
    FROM clientes WHERE valor_ultima_compra >= 100 AND valor_ultima_compra < 500 AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
    UNION ALL
    SELECT 'Médio (R$ 500-2k)', 500, 2000,
      COUNT(*), COALESCE(SUM(valor_ultima_compra), 0)
    FROM clientes WHERE valor_ultima_compra >= 500 AND valor_ultima_compra < 2000 AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
    UNION ALL
    SELECT 'Alto (R$ 2k-5k)', 2000, 5000,
      COUNT(*), COALESCE(SUM(valor_ultima_compra), 0)
    FROM clientes WHERE valor_ultima_compra >= 2000 AND valor_ultima_compra < 5000 AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
    UNION ALL
    SELECT 'Premium (R$ 5k-20k)', 5000, 20000,
      COUNT(*), COALESCE(SUM(valor_ultima_compra), 0)
    FROM clientes WHERE valor_ultima_compra >= 5000 AND valor_ultima_compra < 20000 AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
    UNION ALL
    SELECT 'Enterprise (> R$ 20k)', 20000, 999999999,
      COUNT(*), COALESCE(SUM(valor_ultima_compra), 0)
    FROM clientes WHERE valor_ultima_compra >= 20000 AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id)
  ) faixas;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- RPC: Potencial não explorado por UF
CREATE OR REPLACE FUNCTION public.get_potencial_uf(p_empresa_id integer DEFAULT NULL)
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
    GROUP BY COALESCE(uf, 'N/D')
    HAVING COUNT(*) FILTER (WHERE valor_ultima_compra IS NULL OR valor_ultima_compra <= 0) > 0
  ) sub;

  RETURN result;
END;
$$;

-- RPC: Reativação KPIs (replaces client-side useClienteReativacao heavy processing)
CREATE OR REPLACE FUNCTION public.get_reativacao_kpis(p_empresa_id integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH clientes_risco AS (
    SELECT
      c.*,
      EXTRACT(DAY FROM CURRENT_DATE - c.data_ultima_compra::date) AS dias_sem_compra,
      CASE
        WHEN EXTRACT(DAY FROM CURRENT_DATE - c.data_ultima_compra::date) BETWEEN 31 AND 60 THEN 'atencao'
        WHEN EXTRACT(DAY FROM CURRENT_DATE - c.data_ultima_compra::date) BETWEEN 61 AND 90 THEN 'alerta'
        WHEN EXTRACT(DAY FROM CURRENT_DATE - c.data_ultima_compra::date) BETWEEN 91 AND 180 THEN 'critico'
        WHEN EXTRACT(DAY FROM CURRENT_DATE - c.data_ultima_compra::date) > 180 THEN 'inativo'
        ELSE NULL
      END AS nivel_risco
    FROM clientes c
    WHERE c.valor_ultima_compra > 0
      AND c.data_ultima_compra IS NOT NULL
      AND c.data_ultima_compra < CURRENT_DATE - INTERVAL '30 days'
      AND (p_empresa_id IS NULL OR c.empresa_id = p_empresa_id)
  ),
  kpis AS (
    SELECT
      COUNT(*) AS total_risco,
      COUNT(*) FILTER (WHERE nivel_risco = 'atencao') AS atencao,
      COUNT(*) FILTER (WHERE nivel_risco = 'alerta') AS alerta,
      COUNT(*) FILTER (WHERE nivel_risco = 'critico') AS critico,
      COUNT(*) FILTER (WHERE nivel_risco = 'inativo') AS inativo,
      COALESCE(SUM(valor_ultima_compra), 0) AS receita_em_risco,
      COALESCE(SUM(valor_ultima_compra) FILTER (WHERE nivel_risco = 'atencao'), 0) AS receita_atencao,
      COALESCE(SUM(valor_ultima_compra) FILTER (WHERE nivel_risco = 'alerta'), 0) AS receita_alerta,
      COALESCE(SUM(valor_ultima_compra) FILTER (WHERE nivel_risco = 'critico'), 0) AS receita_critico,
      COALESCE(SUM(valor_ultima_compra) FILTER (WHERE nivel_risco = 'inativo'), 0) AS receita_inativo
    FROM clientes_risco
  )
  SELECT jsonb_build_object(
    'totalEmRisco', total_risco,
    'atencao', atencao,
    'alerta', alerta,
    'critico', critico,
    'inativo', inativo,
    'receitaEmRisco', receita_em_risco,
    'receitaAtencao', receita_atencao,
    'receitaAlerta', receita_alerta,
    'receitaCritico', receita_critico,
    'receitaInativo', receita_inativo
  ) INTO result
  FROM kpis;

  RETURN result;
END;
$$;
