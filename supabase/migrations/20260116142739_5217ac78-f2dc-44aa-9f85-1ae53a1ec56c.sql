-- Função para retornar KPIs agregados do Contas a Receber
CREATE OR REPLACE FUNCTION public.get_contas_receber_dashboard_kpis(
  p_empresas integer[] DEFAULT NULL,
  p_ano integer DEFAULT NULL,
  p_mes integer DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_portador text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_hoje date := CURRENT_DATE;
  v_inicio_mes date := date_trunc('month', CURRENT_DATE)::date;
  v_fim_mes date := (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date;
  v_inicio_mes_anterior date := (date_trunc('month', CURRENT_DATE) - interval '1 month')::date;
  v_fim_mes_anterior date := (date_trunc('month', CURRENT_DATE) - interval '1 day')::date;
  v_data_inicio date;
  v_data_fim date;
BEGIN
  -- Definir período baseado nos filtros
  IF p_ano IS NULL THEN
    v_data_inicio := (EXTRACT(YEAR FROM CURRENT_DATE) - 3)::text || '-01-01';
    v_data_fim := (EXTRACT(YEAR FROM CURRENT_DATE) + 1)::text || '-12-31';
  ELSIF p_mes IS NULL THEN
    v_data_inicio := p_ano::text || '-01-01';
    v_data_fim := p_ano::text || '-12-31';
  ELSE
    v_data_inicio := p_ano::text || '-' || LPAD(p_mes::text, 2, '0') || '-01';
    v_data_fim := (v_data_inicio + interval '1 month - 1 day')::date;
  END IF;

  WITH base AS (
    SELECT *
    FROM contas_receber
    WHERE data_vencimento >= v_data_inicio
      AND data_vencimento <= v_data_fim
      AND (p_empresas IS NULL OR empresa_id = ANY(p_empresas))
      AND (p_conta IS NULL OR conta = p_conta)
      AND (p_portador IS NULL OR portador = p_portador)
  ),
  kpis AS (
    SELECT
      -- Totais gerais
      COUNT(*) AS total_titulos,
      COALESCE(SUM(valor_original), 0) AS total_valor_original,
      COALESCE(SUM(valor_aberto), 0) AS total_valor_aberto,
      COALESCE(SUM(valor_recebido), 0) AS total_valor_recebido,
      
      -- Por status
      COUNT(*) FILTER (WHERE LOWER(status) = 'recebido') AS qtd_recebido,
      COALESCE(SUM(valor_recebido) FILTER (WHERE LOWER(status) = 'recebido'), 0) AS valor_recebido_total,
      
      COUNT(*) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento >= v_hoje) AS qtd_pendente,
      COALESCE(SUM(valor_aberto) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento >= v_hoje), 0) AS valor_pendente,
      
      COUNT(*) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento < v_hoje) AS qtd_vencido,
      COALESCE(SUM(valor_aberto) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento < v_hoje), 0) AS valor_vencido,
      
      -- Vencendo hoje
      COUNT(*) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento = v_hoje) AS qtd_vencendo_hoje,
      COALESCE(SUM(valor_aberto) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento = v_hoje), 0) AS valor_vencendo_hoje,
      
      -- Próximos 7 dias
      COUNT(*) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento >= v_hoje AND data_vencimento <= v_hoje + 7) AS qtd_vencendo_7dias,
      COALESCE(SUM(valor_aberto) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento >= v_hoje AND data_vencimento <= v_hoje + 7), 0) AS valor_vencendo_7dias,
      
      -- Próximos 15 dias
      COALESCE(SUM(valor_aberto) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento >= v_hoje AND data_vencimento <= v_hoje + 15), 0) AS valor_vencendo_15dias,
      
      -- Próximos 30 dias
      COALESCE(SUM(valor_aberto) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento >= v_hoje AND data_vencimento <= v_hoje + 30), 0) AS valor_vencendo_30dias,
      
      -- Vencidas há mais de 30 dias
      COUNT(*) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento < v_hoje - 30) AS qtd_vencidas_30dias,
      COALESCE(SUM(valor_aberto) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento < v_hoje - 30), 0) AS valor_vencidas_30dias,
      
      -- Mês atual
      COALESCE(SUM(valor_original) FILTER (WHERE data_vencimento >= v_inicio_mes AND data_vencimento <= v_fim_mes), 0) AS total_mes_atual,
      
      -- Mês anterior
      COALESCE(SUM(valor_original) FILTER (WHERE data_vencimento >= v_inicio_mes_anterior AND data_vencimento <= v_fim_mes_anterior), 0) AS total_mes_anterior
    FROM base
  ),
  pmr_calc AS (
    SELECT
      CASE 
        WHEN COUNT(*) FILTER (WHERE LOWER(status) = 'recebido' AND data_recebimento IS NOT NULL AND data_emissao IS NOT NULL) > 0 
        THEN ROUND(AVG(data_recebimento - data_emissao) FILTER (WHERE LOWER(status) = 'recebido' AND data_recebimento IS NOT NULL AND data_emissao IS NOT NULL))
        ELSE 0
      END AS pmr,
      CASE 
        WHEN COUNT(*) FILTER (WHERE LOWER(status) = 'recebido' AND data_recebimento IS NOT NULL) > 0 
        THEN ROUND(100.0 * COUNT(*) FILTER (WHERE LOWER(status) = 'recebido' AND data_recebimento IS NOT NULL AND data_recebimento <= data_vencimento) / 
             NULLIF(COUNT(*) FILTER (WHERE LOWER(status) = 'recebido' AND data_recebimento IS NOT NULL), 0))
        ELSE 0
      END AS indice_pontualidade
    FROM base
  )
  SELECT jsonb_build_object(
    'total_titulos', k.total_titulos,
    'total_valor_original', k.total_valor_original,
    'total_valor_aberto', k.total_valor_aberto,
    'total_valor_recebido', k.total_valor_recebido,
    'qtd_recebido', k.qtd_recebido,
    'valor_recebido_total', k.valor_recebido_total,
    'qtd_pendente', k.qtd_pendente,
    'valor_pendente', k.valor_pendente,
    'qtd_vencido', k.qtd_vencido,
    'valor_vencido', k.valor_vencido,
    'qtd_vencendo_hoje', k.qtd_vencendo_hoje,
    'valor_vencendo_hoje', k.valor_vencendo_hoje,
    'qtd_vencendo_7dias', k.qtd_vencendo_7dias,
    'valor_vencendo_7dias', k.valor_vencendo_7dias,
    'valor_vencendo_15dias', k.valor_vencendo_15dias,
    'valor_vencendo_30dias', k.valor_vencendo_30dias,
    'qtd_vencidas_30dias', k.qtd_vencidas_30dias,
    'valor_vencidas_30dias', k.valor_vencidas_30dias,
    'total_mes_atual', k.total_mes_atual,
    'total_mes_anterior', k.total_mes_anterior,
    'variacao_mensal', CASE WHEN k.total_mes_anterior > 0 THEN ROUND(((k.total_mes_atual - k.total_mes_anterior) / k.total_mes_anterior) * 100) ELSE 0 END,
    'pmr', p.pmr,
    'indice_pontualidade', p.indice_pontualidade
  ) INTO v_result
  FROM kpis k, pmr_calc p;

  RETURN v_result;
END;
$$;

-- Função para retornar evolução mensal (últimos 6 meses)
CREATE OR REPLACE FUNCTION public.get_contas_receber_evolucao_mensal(
  p_empresas integer[] DEFAULT NULL,
  p_ano integer DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_portador text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH meses AS (
    SELECT 
      date_trunc('month', generate_series)::date AS inicio,
      (date_trunc('month', generate_series) + interval '1 month - 1 day')::date AS fim,
      to_char(generate_series, 'Mon/YY') AS mes_label
    FROM generate_series(
      CURRENT_DATE - interval '5 months',
      CURRENT_DATE,
      interval '1 month'
    )
  ),
  dados AS (
    SELECT 
      m.mes_label,
      m.inicio,
      COALESCE(SUM(c.valor_recebido) FILTER (WHERE LOWER(c.status) = 'recebido'), 0) AS recebido,
      COALESCE(SUM(c.valor_aberto) FILTER (WHERE LOWER(c.status) IN ('pendente', 'parcial')), 0) AS pendente
    FROM meses m
    LEFT JOIN contas_receber c ON c.data_vencimento >= m.inicio AND c.data_vencimento <= m.fim
      AND (p_empresas IS NULL OR c.empresa_id = ANY(p_empresas))
      AND (p_ano IS NULL OR EXTRACT(YEAR FROM c.data_vencimento) = p_ano OR (p_ano IS NULL AND EXTRACT(YEAR FROM c.data_vencimento) >= EXTRACT(YEAR FROM CURRENT_DATE) - 3))
      AND (p_conta IS NULL OR c.conta = p_conta)
      AND (p_portador IS NULL OR c.portador = p_portador)
    GROUP BY m.mes_label, m.inicio
    ORDER BY m.inicio
  )
  SELECT jsonb_agg(jsonb_build_object(
    'mes', mes_label,
    'recebido', recebido,
    'pendente', pendente
  )) INTO v_result
  FROM dados;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Função para retornar top 10 clientes devedores
CREATE OR REPLACE FUNCTION public.get_contas_receber_top_clientes(
  p_empresas integer[] DEFAULT NULL,
  p_ano integer DEFAULT NULL,
  p_mes integer DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_portador text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_data_inicio date;
  v_data_fim date;
BEGIN
  -- Definir período
  IF p_ano IS NULL THEN
    v_data_inicio := (EXTRACT(YEAR FROM CURRENT_DATE) - 3)::text || '-01-01';
    v_data_fim := (EXTRACT(YEAR FROM CURRENT_DATE) + 1)::text || '-12-31';
  ELSIF p_mes IS NULL THEN
    v_data_inicio := p_ano::text || '-01-01';
    v_data_fim := p_ano::text || '-12-31';
  ELSE
    v_data_inicio := p_ano::text || '-' || LPAD(p_mes::text, 2, '0') || '-01';
    v_data_fim := (v_data_inicio + interval '1 month - 1 day')::date;
  END IF;

  WITH top AS (
    SELECT 
      COALESCE(cliente_nome, 'Não informado') AS nome,
      SUM(valor_aberto) AS valor
    FROM contas_receber
    WHERE data_vencimento >= v_data_inicio
      AND data_vencimento <= v_data_fim
      AND LOWER(status) IN ('pendente', 'parcial')
      AND (p_empresas IS NULL OR empresa_id = ANY(p_empresas))
      AND (p_conta IS NULL OR conta = p_conta)
      AND (p_portador IS NULL OR portador = p_portador)
    GROUP BY cliente_nome
    ORDER BY valor DESC
    LIMIT 10
  )
  SELECT jsonb_agg(jsonb_build_object(
    'nome', CASE WHEN LENGTH(nome) > 20 THEN LEFT(nome, 20) || '...' ELSE nome END,
    'nomeCompleto', nome,
    'valor', valor
  )) INTO v_result
  FROM top;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Função para retornar aging report (faixas de vencimento)
CREATE OR REPLACE FUNCTION public.get_contas_receber_aging(
  p_empresas integer[] DEFAULT NULL,
  p_ano integer DEFAULT NULL,
  p_mes integer DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_portador text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_hoje date := CURRENT_DATE;
  v_data_inicio date;
  v_data_fim date;
BEGIN
  -- Definir período
  IF p_ano IS NULL THEN
    v_data_inicio := (EXTRACT(YEAR FROM CURRENT_DATE) - 3)::text || '-01-01';
    v_data_fim := (EXTRACT(YEAR FROM CURRENT_DATE) + 1)::text || '-12-31';
  ELSIF p_mes IS NULL THEN
    v_data_inicio := p_ano::text || '-01-01';
    v_data_fim := p_ano::text || '-12-31';
  ELSE
    v_data_inicio := p_ano::text || '-' || LPAD(p_mes::text, 2, '0') || '-01';
    v_data_fim := (v_data_inicio + interval '1 month - 1 day')::date;
  END IF;

  WITH base AS (
    SELECT data_vencimento, valor_aberto
    FROM contas_receber
    WHERE data_vencimento >= v_data_inicio
      AND data_vencimento <= v_data_fim
      AND LOWER(status) IN ('pendente', 'parcial')
      AND (p_empresas IS NULL OR empresa_id = ANY(p_empresas))
      AND (p_conta IS NULL OR conta = p_conta)
      AND (p_portador IS NULL OR portador = p_portador)
  ),
  faixas AS (
    SELECT 
      CASE 
        WHEN data_vencimento < v_hoje THEN 'Vencido'
        WHEN data_vencimento = v_hoje THEN 'Hoje'
        WHEN data_vencimento <= v_hoje + 30 THEN '1-30 dias'
        WHEN data_vencimento <= v_hoje + 60 THEN '31-60 dias'
        WHEN data_vencimento <= v_hoje + 90 THEN '61-90 dias'
        ELSE '+90 dias'
      END AS nome,
      CASE 
        WHEN data_vencimento < v_hoje THEN 1
        WHEN data_vencimento = v_hoje THEN 2
        WHEN data_vencimento <= v_hoje + 30 THEN 3
        WHEN data_vencimento <= v_hoje + 60 THEN 4
        WHEN data_vencimento <= v_hoje + 90 THEN 5
        ELSE 6
      END AS ordem,
      valor_aberto
    FROM base
  )
  SELECT jsonb_agg(jsonb_build_object(
    'nome', nome,
    'valor', valor,
    'qtd', qtd
  ) ORDER BY ordem) INTO v_result
  FROM (
    SELECT nome, ordem, SUM(valor_aberto) AS valor, COUNT(*) AS qtd
    FROM faixas
    GROUP BY nome, ordem
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Função para retornar distribuição por status
CREATE OR REPLACE FUNCTION public.get_contas_receber_status_dist(
  p_empresas integer[] DEFAULT NULL,
  p_ano integer DEFAULT NULL,
  p_mes integer DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_portador text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_hoje date := CURRENT_DATE;
  v_data_inicio date;
  v_data_fim date;
BEGIN
  -- Definir período
  IF p_ano IS NULL THEN
    v_data_inicio := (EXTRACT(YEAR FROM CURRENT_DATE) - 3)::text || '-01-01';
    v_data_fim := (EXTRACT(YEAR FROM CURRENT_DATE) + 1)::text || '-12-31';
  ELSIF p_mes IS NULL THEN
    v_data_inicio := p_ano::text || '-01-01';
    v_data_fim := p_ano::text || '-12-31';
  ELSE
    v_data_inicio := p_ano::text || '-' || LPAD(p_mes::text, 2, '0') || '-01';
    v_data_fim := (v_data_inicio + interval '1 month - 1 day')::date;
  END IF;

  WITH base AS (
    SELECT 
      CASE 
        WHEN LOWER(status) = 'recebido' THEN 'Recebido'
        WHEN LOWER(status) = 'parcial' THEN 'Parcial'
        WHEN data_vencimento < v_hoje AND LOWER(status) IN ('pendente', 'parcial') THEN 'Vencido'
        ELSE 'Pendente'
      END AS status_calc,
      valor_original
    FROM contas_receber
    WHERE data_vencimento >= v_data_inicio
      AND data_vencimento <= v_data_fim
      AND (p_empresas IS NULL OR empresa_id = ANY(p_empresas))
      AND (p_conta IS NULL OR conta = p_conta)
      AND (p_portador IS NULL OR portador = p_portador)
  )
  SELECT jsonb_agg(jsonb_build_object(
    'nome', status_calc,
    'valor', valor,
    'qtd', qtd
  )) INTO v_result
  FROM (
    SELECT status_calc, SUM(valor_original) AS valor, COUNT(*) AS qtd
    FROM base
    GROUP BY status_calc
    HAVING COUNT(*) > 0
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Função para retornar dados do calendário (agrupados por dia)
CREATE OR REPLACE FUNCTION public.get_contas_receber_calendario(
  p_empresas integer[] DEFAULT NULL,
  p_ano integer DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_portador text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_data_inicio date;
  v_data_fim date;
  v_hoje date := CURRENT_DATE;
BEGIN
  -- Definir período (ano inteiro)
  IF p_ano IS NULL THEN
    v_data_inicio := (EXTRACT(YEAR FROM CURRENT_DATE) - 2)::text || '-01-01';
    v_data_fim := (EXTRACT(YEAR FROM CURRENT_DATE) + 1)::text || '-12-31';
  ELSE
    v_data_inicio := p_ano::text || '-01-01';
    v_data_fim := p_ano::text || '-12-31';
  END IF;

  WITH base AS (
    SELECT 
      data_vencimento,
      valor_aberto,
      valor_original,
      status
    FROM contas_receber
    WHERE data_vencimento >= v_data_inicio
      AND data_vencimento <= v_data_fim
      AND (p_empresas IS NULL OR empresa_id = ANY(p_empresas))
      AND (p_conta IS NULL OR conta = p_conta)
      AND (p_portador IS NULL OR portador = p_portador)
  )
  SELECT jsonb_agg(jsonb_build_object(
    'data', data_vencimento,
    'qtd', qtd,
    'valor_total', valor_total,
    'qtd_recebido', qtd_recebido,
    'valor_recebido', valor_recebido,
    'qtd_pendente', qtd_pendente,
    'valor_pendente', valor_pendente,
    'qtd_vencido', qtd_vencido,
    'valor_vencido', valor_vencido
  )) INTO v_result
  FROM (
    SELECT 
      data_vencimento,
      COUNT(*) AS qtd,
      SUM(COALESCE(valor_aberto, valor_original)) AS valor_total,
      COUNT(*) FILTER (WHERE LOWER(status) = 'recebido') AS qtd_recebido,
      SUM(valor_aberto) FILTER (WHERE LOWER(status) = 'recebido') AS valor_recebido,
      COUNT(*) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento >= v_hoje) AS qtd_pendente,
      SUM(valor_aberto) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento >= v_hoje) AS valor_pendente,
      COUNT(*) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento < v_hoje) AS qtd_vencido,
      SUM(valor_aberto) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento < v_hoje) AS valor_vencido
    FROM base
    GROUP BY data_vencimento
    ORDER BY data_vencimento
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Função para retornar listas únicas (empresas, contas, portadores) para filtros
CREATE OR REPLACE FUNCTION public.get_contas_receber_filtros(
  p_ano integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_data_inicio date;
  v_data_fim date;
BEGIN
  -- Definir período
  IF p_ano IS NULL THEN
    v_data_inicio := (EXTRACT(YEAR FROM CURRENT_DATE) - 3)::text || '-01-01';
    v_data_fim := (EXTRACT(YEAR FROM CURRENT_DATE) + 1)::text || '-12-31';
  ELSE
    v_data_inicio := p_ano::text || '-01-01';
    v_data_fim := p_ano::text || '-12-31';
  END IF;

  WITH empresas AS (
    SELECT DISTINCT empresa_id AS id, empresa_nome AS nome
    FROM contas_receber
    WHERE data_vencimento >= v_data_inicio AND data_vencimento <= v_data_fim
      AND empresa_id IS NOT NULL AND empresa_nome IS NOT NULL
    ORDER BY empresa_nome
  ),
  contas AS (
    SELECT DISTINCT conta
    FROM contas_receber
    WHERE data_vencimento >= v_data_inicio AND data_vencimento <= v_data_fim
      AND conta IS NOT NULL
    ORDER BY conta
  ),
  portadores AS (
    SELECT DISTINCT portador
    FROM contas_receber
    WHERE data_vencimento >= v_data_inicio AND data_vencimento <= v_data_fim
      AND portador IS NOT NULL
    ORDER BY portador
  )
  SELECT jsonb_build_object(
    'empresas', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'nome', nome)), '[]'::jsonb) FROM empresas),
    'contas', (SELECT COALESCE(jsonb_agg(conta), '[]'::jsonb) FROM contas),
    'portadores', (SELECT COALESCE(jsonb_agg(portador), '[]'::jsonb) FROM portadores)
  ) INTO v_result;

  RETURN v_result;
END;
$$;