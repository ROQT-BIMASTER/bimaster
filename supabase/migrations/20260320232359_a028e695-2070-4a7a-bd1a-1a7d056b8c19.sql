-- Fix all get_contas_receber_* RPCs: search_path TO '' → search_path TO 'public'
-- Also drop the duplicate 5-param dashboard_kpis overload

-- 1. Drop the 5-param overload of dashboard_kpis
DROP FUNCTION IF EXISTS public.get_contas_receber_dashboard_kpis(integer[], integer, integer, text, text);

-- 2. Recreate 7-param dashboard_kpis with correct search_path
CREATE OR REPLACE FUNCTION public.get_contas_receber_dashboard_kpis(
  p_empresas integer[] DEFAULT NULL::integer[],
  p_ano integer DEFAULT NULL::integer,
  p_mes integer DEFAULT NULL::integer,
  p_conta text DEFAULT NULL::text,
  p_portador text DEFAULT NULL::text,
  p_data_vencimento date DEFAULT NULL::date,
  p_data_recebimento date DEFAULT NULL::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  IF p_data_vencimento IS NOT NULL THEN
    v_data_inicio := p_data_vencimento;
    v_data_fim := p_data_vencimento;
  ELSIF p_ano IS NULL THEN
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
      AND (p_data_recebimento IS NULL OR data_recebimento = p_data_recebimento)
  ),
  kpis AS (
    SELECT
      COUNT(*) AS total_titulos,
      COALESCE(SUM(valor_original), 0) AS total_valor_original,
      COALESCE(SUM(valor_aberto), 0) AS total_valor_aberto,
      COALESCE(SUM(valor_recebido), 0) AS total_valor_recebido,
      COUNT(*) FILTER (WHERE LOWER(status) = 'recebido') AS qtd_recebido,
      COALESCE(SUM(valor_recebido) FILTER (WHERE LOWER(status) = 'recebido'), 0) AS valor_recebido_total,
      COUNT(*) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento >= v_hoje) AS qtd_pendente,
      COALESCE(SUM(valor_aberto) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento >= v_hoje), 0) AS valor_pendente,
      COUNT(*) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento < v_hoje) AS qtd_vencido,
      COALESCE(SUM(valor_aberto) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento < v_hoje), 0) AS valor_vencido,
      COUNT(*) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento = v_hoje) AS qtd_vencendo_hoje,
      COALESCE(SUM(valor_aberto) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento = v_hoje), 0) AS valor_vencendo_hoje,
      COUNT(*) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento >= v_hoje AND data_vencimento <= v_hoje + 7) AS qtd_vencendo_7dias,
      COALESCE(SUM(valor_aberto) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento >= v_hoje AND data_vencimento <= v_hoje + 7), 0) AS valor_vencendo_7dias,
      COALESCE(SUM(valor_aberto) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento >= v_hoje AND data_vencimento <= v_hoje + 15), 0) AS valor_vencendo_15dias,
      COALESCE(SUM(valor_aberto) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento >= v_hoje AND data_vencimento <= v_hoje + 30), 0) AS valor_vencendo_30dias,
      COUNT(*) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento < v_hoje - 30) AS qtd_vencidas_30dias,
      COALESCE(SUM(valor_aberto) FILTER (WHERE LOWER(status) IN ('pendente', 'parcial') AND data_vencimento < v_hoje - 30), 0) AS valor_vencidas_30dias,
      COALESCE(SUM(valor_original) FILTER (WHERE data_vencimento >= v_inicio_mes AND data_vencimento <= v_fim_mes), 0) AS total_mes_atual,
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
        THEN ROUND(100.0 * COUNT(*) FILTER (WHERE LOWER(status) = 'recebido' AND data_recebimento IS NOT NULL AND data_recebimento <= data_vencimento) / NULLIF(COUNT(*) FILTER (WHERE LOWER(status) = 'recebido' AND data_recebimento IS NOT NULL), 0))
        ELSE 0
      END AS indice_pontualidade
    FROM base
  )
  SELECT jsonb_build_object(
    'total_titulos', kpis.total_titulos,
    'total_valor_original', kpis.total_valor_original,
    'total_valor_aberto', kpis.total_valor_aberto,
    'total_valor_recebido', kpis.total_valor_recebido,
    'qtd_recebido', kpis.qtd_recebido,
    'valor_recebido_total', kpis.valor_recebido_total,
    'qtd_pendente', kpis.qtd_pendente,
    'valor_pendente', kpis.valor_pendente,
    'qtd_vencido', kpis.qtd_vencido,
    'valor_vencido', kpis.valor_vencido,
    'qtd_vencendo_hoje', kpis.qtd_vencendo_hoje,
    'valor_vencendo_hoje', kpis.valor_vencendo_hoje,
    'qtd_vencendo_7dias', kpis.qtd_vencendo_7dias,
    'valor_vencendo_7dias', kpis.valor_vencendo_7dias,
    'valor_vencendo_15dias', kpis.valor_vencendo_15dias,
    'valor_vencendo_30dias', kpis.valor_vencendo_30dias,
    'qtd_vencidas_30dias', kpis.qtd_vencidas_30dias,
    'valor_vencidas_30dias', kpis.valor_vencidas_30dias,
    'total_mes_atual', kpis.total_mes_atual,
    'total_mes_anterior', kpis.total_mes_anterior,
    'variacao_mensal', CASE 
      WHEN kpis.total_mes_anterior > 0 
      THEN ROUND(((kpis.total_mes_atual - kpis.total_mes_anterior) / kpis.total_mes_anterior * 100)::numeric, 1)
      ELSE 0 
    END,
    'pmr', pmr_calc.pmr,
    'indice_pontualidade', pmr_calc.indice_pontualidade
  ) INTO v_result
  FROM kpis, pmr_calc;
  
  RETURN v_result;
END;
$function$;

-- 3. Recreate evolucao_mensal
CREATE OR REPLACE FUNCTION public.get_contas_receber_evolucao_mensal(
  p_empresas integer[] DEFAULT NULL::integer[],
  p_ano integer DEFAULT NULL::integer,
  p_conta text DEFAULT NULL::text,
  p_portador text DEFAULT NULL::text
)
RETURNS TABLE(mes text, recebido numeric, pendente numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_start_date date;
  v_end_date date;
BEGIN
  IF p_ano IS NOT NULL THEN
    v_start_date := make_date(p_ano, 1, 1);
    v_end_date := make_date(p_ano, 12, 31);
  ELSE
    v_start_date := date_trunc('month', current_date - interval '6 months')::date;
    v_end_date := (date_trunc('month', current_date + interval '6 months') + interval '1 month' - interval '1 day')::date;
  END IF;

  RETURN QUERY
  WITH meses AS (
    SELECT generate_series(
      date_trunc('month', v_start_date),
      date_trunc('month', v_end_date),
      interval '1 month'
    )::date AS mes_inicio
  ),
  dados AS (
    SELECT 
      date_trunc('month', COALESCE(data_recebimento, data_vencimento)::date)::date AS mes_ref,
      COALESCE(SUM(CASE WHEN lower(status) = 'recebido' THEN valor_recebido ELSE 0 END), 0) AS valor_recebido,
      COALESCE(SUM(CASE WHEN lower(status) IN ('pendente', 'vencido', 'parcial') THEN valor_aberto ELSE 0 END), 0) AS valor_pendente
    FROM contas_receber
    WHERE 
      COALESCE(data_recebimento, data_vencimento) >= v_start_date
      AND COALESCE(data_recebimento, data_vencimento) <= v_end_date
      AND (p_empresas IS NULL OR empresa_id = ANY(p_empresas))
      AND (p_conta IS NULL OR conta = p_conta)
      AND (p_portador IS NULL OR portador = p_portador)
    GROUP BY date_trunc('month', COALESCE(data_recebimento, data_vencimento)::date)
  )
  SELECT 
    to_char(m.mes_inicio, 'Mon/YY') AS mes,
    COALESCE(d.valor_recebido, 0) AS recebido,
    COALESCE(d.valor_pendente, 0) AS pendente
  FROM meses m
  LEFT JOIN dados d ON d.mes_ref = m.mes_inicio
  ORDER BY m.mes_inicio;
END;
$function$;

-- 4. Recreate top_clientes
CREATE OR REPLACE FUNCTION public.get_contas_receber_top_clientes(
  p_empresas integer[] DEFAULT NULL::integer[],
  p_ano integer DEFAULT NULL::integer,
  p_mes integer DEFAULT NULL::integer,
  p_conta text DEFAULT NULL::text,
  p_portador text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_data_inicio date;
  v_data_fim date;
BEGIN
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
$function$;

-- 5. Recreate aging
CREATE OR REPLACE FUNCTION public.get_contas_receber_aging(
  p_empresas integer[] DEFAULT NULL::integer[],
  p_ano integer DEFAULT NULL::integer,
  p_mes integer DEFAULT NULL::integer,
  p_conta text DEFAULT NULL::text,
  p_portador text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_hoje date := CURRENT_DATE;
  v_data_inicio date;
  v_data_fim date;
BEGIN
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
$function$;

-- 6. Recreate status_dist
CREATE OR REPLACE FUNCTION public.get_contas_receber_status_dist(
  p_empresas integer[] DEFAULT NULL::integer[],
  p_ano integer DEFAULT NULL::integer,
  p_mes integer DEFAULT NULL::integer,
  p_conta text DEFAULT NULL::text,
  p_portador text DEFAULT NULL::text
)
RETURNS TABLE(status text, quantidade bigint, valor numeric, percentual numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN LOWER(cr.status) = 'recebido' THEN COALESCE(cr.valor_recebido, cr.valor_original)
      ELSE COALESCE(cr.valor_original, 0)
    END
  ), 0) INTO v_total
  FROM contas_receber cr
  WHERE 
    (p_empresas IS NULL OR cr.empresa_id = ANY(p_empresas))
    AND (p_ano IS NULL OR EXTRACT(YEAR FROM cr.data_vencimento) = p_ano)
    AND (p_mes IS NULL OR EXTRACT(MONTH FROM cr.data_vencimento) = p_mes)
    AND (p_conta IS NULL OR cr.conta = p_conta)
    AND (p_portador IS NULL OR cr.portador = p_portador);

  RETURN QUERY
  SELECT 
    CASE 
      WHEN LOWER(cr.status) = 'recebido' THEN 'Recebido'
      WHEN LOWER(cr.status) = 'vencido' THEN 'Vencido'
      WHEN LOWER(cr.status) = 'parcial' THEN 'Parcial'
      ELSE 'Pendente'
    END AS status_calc,
    COUNT(*)::BIGINT AS quantidade,
    SUM(CASE 
      WHEN LOWER(cr.status) = 'recebido' THEN COALESCE(cr.valor_recebido, cr.valor_original)
      ELSE COALESCE(cr.valor_original, 0)
    END)::NUMERIC AS valor,
    CASE WHEN v_total > 0 THEN 
      ROUND((SUM(CASE 
        WHEN LOWER(cr.status) = 'recebido' THEN COALESCE(cr.valor_recebido, cr.valor_original)
        ELSE COALESCE(cr.valor_original, 0)
      END) / v_total * 100)::NUMERIC, 2)
    ELSE 0 END AS percentual
  FROM contas_receber cr
  WHERE 
    (p_empresas IS NULL OR cr.empresa_id = ANY(p_empresas))
    AND (p_ano IS NULL OR EXTRACT(YEAR FROM cr.data_vencimento) = p_ano)
    AND (p_mes IS NULL OR EXTRACT(MONTH FROM cr.data_vencimento) = p_mes)
    AND (p_conta IS NULL OR cr.conta = p_conta)
    AND (p_portador IS NULL OR cr.portador = p_portador)
  GROUP BY status_calc
  ORDER BY valor DESC;
END;
$function$;

-- 7. Recreate pmr_detalhes
CREATE OR REPLACE FUNCTION public.get_contas_receber_pmr_detalhes(
  p_empresas integer[] DEFAULT NULL::integer[],
  p_ano integer DEFAULT NULL::integer,
  p_mes integer DEFAULT NULL::integer,
  p_conta text DEFAULT NULL::text,
  p_portador text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_data_inicio date;
  v_data_fim date;
BEGIN
  IF p_ano IS NULL THEN
    v_data_inicio := (EXTRACT(YEAR FROM CURRENT_DATE) - 1)::text || '-01-01';
    v_data_fim := CURRENT_DATE;
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
      AND LOWER(status) = 'recebido'
      AND data_recebimento IS NOT NULL
      AND data_emissao IS NOT NULL
  ),
  stats AS (
    SELECT
      COUNT(*) AS total_titulos_analisados,
      ROUND(AVG(data_recebimento - data_emissao)) AS pmr_emissao_recebimento,
      ROUND(AVG(data_recebimento - data_vencimento)) AS pmr_vencimento_recebimento,
      MIN(data_recebimento - data_emissao) AS menor_prazo,
      MAX(data_recebimento - data_emissao) AS maior_prazo,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (data_recebimento - data_emissao)) AS mediana_prazo,
      COUNT(*) FILTER (WHERE data_recebimento <= data_vencimento) AS recebidos_no_prazo,
      COUNT(*) FILTER (WHERE data_recebimento > data_vencimento) AS recebidos_em_atraso,
      COALESCE(SUM(valor_recebido) FILTER (WHERE data_recebimento <= data_vencimento), 0) AS valor_no_prazo,
      COALESCE(SUM(valor_recebido) FILTER (WHERE data_recebimento > data_vencimento), 0) AS valor_em_atraso
    FROM base
  ),
  faixas AS (
    SELECT
      COUNT(*) FILTER (WHERE (data_recebimento - data_emissao) <= 15) AS ate_15_dias,
      COUNT(*) FILTER (WHERE (data_recebimento - data_emissao) > 15 AND (data_recebimento - data_emissao) <= 30) AS de_16_a_30_dias,
      COUNT(*) FILTER (WHERE (data_recebimento - data_emissao) > 30 AND (data_recebimento - data_emissao) <= 45) AS de_31_a_45_dias,
      COUNT(*) FILTER (WHERE (data_recebimento - data_emissao) > 45 AND (data_recebimento - data_emissao) <= 60) AS de_46_a_60_dias,
      COUNT(*) FILTER (WHERE (data_recebimento - data_emissao) > 60) AS acima_60_dias
    FROM base
  ),
  por_mes AS (
    SELECT 
      TO_CHAR(data_recebimento, 'YYYY-MM') AS mes,
      COUNT(*) AS qtd,
      ROUND(AVG(data_recebimento - data_emissao)) AS pmr_mes
    FROM base
    GROUP BY TO_CHAR(data_recebimento, 'YYYY-MM')
    ORDER BY mes DESC
    LIMIT 6
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('data_inicio', v_data_inicio, 'data_fim', v_data_fim),
    'resumo', (SELECT row_to_json(stats.*) FROM stats),
    'faixas', (SELECT row_to_json(faixas.*) FROM faixas),
    'por_mes', COALESCE((SELECT jsonb_agg(row_to_json(por_mes.*)) FROM por_mes), '[]'::jsonb),
    'formula', 'PMR = Média(Data Recebimento - Data Emissão) para títulos com status Recebido',
    'observacoes', ARRAY[
      'PMR considera apenas títulos efetivamente recebidos',
      'Calcula a diferença em dias entre data de emissão e data de recebimento',
      'Títulos sem data de recebimento ou emissão são excluídos do cálculo',
      'PMR Vencimento: diferença entre vencimento e recebimento (negativo = recebeu antes)'
    ]
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- 8. Recreate calendario
CREATE OR REPLACE FUNCTION public.get_contas_receber_calendario(
  p_empresas integer[] DEFAULT NULL::integer[],
  p_ano integer DEFAULT NULL::integer,
  p_conta text DEFAULT NULL::text,
  p_portador text DEFAULT NULL::text
)
RETURNS TABLE(data_vencimento date, qtd_titulos bigint, valor_total numeric, qtd_vencido bigint, valor_vencido numeric, qtd_pendente bigint, valor_pendente numeric, qtd_recebido bigint, valor_recebido numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    cr.data_vencimento::DATE,
    COUNT(*)::BIGINT AS qtd_titulos,
    SUM(CASE 
      WHEN LOWER(cr.status) = 'recebido' THEN COALESCE(cr.valor_recebido, cr.valor_original)
      ELSE COALESCE(cr.valor_aberto, cr.valor_original)
    END)::NUMERIC AS valor_total,
    COUNT(*) FILTER (WHERE LOWER(cr.status) = 'vencido')::BIGINT AS qtd_vencido,
    COALESCE(SUM(cr.valor_aberto) FILTER (WHERE LOWER(cr.status) = 'vencido'), 0)::NUMERIC AS valor_vencido,
    COUNT(*) FILTER (WHERE LOWER(cr.status) IN ('pendente', 'parcial'))::BIGINT AS qtd_pendente,
    COALESCE(SUM(cr.valor_aberto) FILTER (WHERE LOWER(cr.status) IN ('pendente', 'parcial')), 0)::NUMERIC AS valor_pendente,
    COUNT(*) FILTER (WHERE LOWER(cr.status) = 'recebido')::BIGINT AS qtd_recebido,
    COALESCE(SUM(cr.valor_recebido) FILTER (WHERE LOWER(cr.status) = 'recebido'), 0)::NUMERIC AS valor_recebido
  FROM contas_receber cr
  WHERE 
    (p_empresas IS NULL OR cr.empresa_id = ANY(p_empresas))
    AND (p_ano IS NULL OR EXTRACT(YEAR FROM cr.data_vencimento) = p_ano)
    AND (p_conta IS NULL OR cr.conta = p_conta)
    AND (p_portador IS NULL OR cr.portador = p_portador)
  GROUP BY cr.data_vencimento::DATE
  ORDER BY cr.data_vencimento::DATE;
END;
$function$;

-- 9. Recreate filter_options
CREATE OR REPLACE FUNCTION public.get_contas_receber_filter_options(
  p_anos integer[] DEFAULT NULL::integer[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_data_inicio date;
  v_data_fim date;
BEGIN
  IF p_anos IS NULL OR array_length(p_anos, 1) IS NULL THEN
    v_data_inicio := (EXTRACT(YEAR FROM CURRENT_DATE) - 3)::text || '-01-01';
    v_data_fim := (EXTRACT(YEAR FROM CURRENT_DATE) + 1)::text || '-12-31';
  ELSE
    v_data_inicio := (SELECT MIN(a) FROM unnest(p_anos) AS a)::text || '-01-01';
    v_data_fim := (SELECT MAX(a) FROM unnest(p_anos) AS a)::text || '-12-31';
  END IF;

  WITH base AS (
    SELECT DISTINCT empresa_id, empresa_nome, conta, portador
    FROM contas_receber
    WHERE data_vencimento >= v_data_inicio
      AND data_vencimento <= v_data_fim
  ),
  empresas AS (
    SELECT jsonb_agg(DISTINCT jsonb_build_object('id', empresa_id, 'nome', empresa_nome)) 
    FROM base WHERE empresa_id IS NOT NULL AND empresa_nome IS NOT NULL
  ),
  contas AS (
    SELECT jsonb_agg(DISTINCT conta ORDER BY conta) 
    FROM base WHERE conta IS NOT NULL AND conta != ''
  ),
  portadores AS (
    SELECT jsonb_agg(DISTINCT portador ORDER BY portador) 
    FROM base WHERE portador IS NOT NULL AND portador != ''
  )
  SELECT jsonb_build_object(
    'empresas', COALESCE((SELECT * FROM empresas), '[]'::jsonb),
    'contas', COALESCE((SELECT * FROM contas), '[]'::jsonb),
    'portadores', COALESCE((SELECT * FROM portadores), '[]'::jsonb)
  ) INTO v_result;
  
  RETURN v_result;
END;
$function$;

-- 10. Recreate filtros
CREATE OR REPLACE FUNCTION public.get_contas_receber_filtros(
  p_ano integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_data_inicio date;
  v_data_fim date;
BEGIN
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
$function$;

-- 11. GRANTs
GRANT EXECUTE ON FUNCTION public.get_contas_receber_dashboard_kpis(integer[], integer, integer, text, text, date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_contas_receber_evolucao_mensal(integer[], integer, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_contas_receber_top_clientes(integer[], integer, integer, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_contas_receber_aging(integer[], integer, integer, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_contas_receber_status_dist(integer[], integer, integer, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_contas_receber_pmr_detalhes(integer[], integer, integer, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_contas_receber_calendario(integer[], integer, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_contas_receber_filter_options(integer[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_contas_receber_filtros(integer) TO anon, authenticated;