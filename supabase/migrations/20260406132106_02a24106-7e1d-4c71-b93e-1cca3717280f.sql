
-- 1. Fix trigger to use Brazil timezone
CREATE OR REPLACE FUNCTION public.calcular_status_conta_receber()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_hoje DATE := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NEW.data_vencimento IS NOT NULL THEN
    NEW.dias_atraso := GREATEST(0, v_hoje - NEW.data_vencimento);
  ELSE
    NEW.dias_atraso := 0;
  END IF;
  
  IF COALESCE(NEW.valor_aberto, 0) <= 0 THEN
    NEW.status := 'recebido';
  ELSIF COALESCE(NEW.valor_recebido, 0) > 0 AND COALESCE(NEW.valor_aberto, 0) > 0 THEN
    NEW.status := 'parcial';
  ELSIF NEW.data_vencimento < v_hoje AND COALESCE(NEW.valor_aberto, 0) > 0 THEN
    NEW.status := 'vencido';
  ELSE
    NEW.status := 'pendente';
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- 2. Fix KPIs RPC to use Brazil timezone
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
  v_hoje date := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_inicio_mes date := date_trunc('month', (NOW() AT TIME ZONE 'America/Sao_Paulo'))::date;
  v_fim_mes date := (date_trunc('month', (NOW() AT TIME ZONE 'America/Sao_Paulo')) + interval '1 month - 1 day')::date;
  v_inicio_mes_anterior date := (date_trunc('month', (NOW() AT TIME ZONE 'America/Sao_Paulo')) - interval '1 month')::date;
  v_fim_mes_anterior date := (date_trunc('month', (NOW() AT TIME ZONE 'America/Sao_Paulo')) - interval '1 day')::date;
  v_data_inicio date;
  v_data_fim date;
  v_empresas integer[];
  v_empresas_permitidas integer[];
BEGIN
  v_empresas_permitidas := get_empresa_ids_do_usuario();
  IF p_empresas IS NOT NULL THEN
    v_empresas := ARRAY(SELECT unnest(p_empresas) INTERSECT SELECT unnest(v_empresas_permitidas));
  ELSE
    v_empresas := v_empresas_permitidas;
  END IF;

  IF p_data_vencimento IS NOT NULL THEN
    v_data_inicio := p_data_vencimento;
    v_data_fim := p_data_vencimento;
  ELSIF p_ano IS NULL THEN
    v_data_inicio := (EXTRACT(YEAR FROM v_hoje) - 3)::text || '-01-01';
    v_data_fim := (EXTRACT(YEAR FROM v_hoje) + 1)::text || '-12-31';
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
      AND empresa_id = ANY(v_empresas)
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

-- 3. Fix Aging RPC to use Brazil timezone
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
  v_hoje date := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_data_inicio date;
  v_data_fim date;
BEGIN
  IF p_ano IS NULL THEN
    v_data_inicio := (EXTRACT(YEAR FROM v_hoje) - 3)::text || '-01-01';
    v_data_fim := (EXTRACT(YEAR FROM v_hoje) + 1)::text || '-12-31';
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

-- 4. Recalculate existing pending/overdue records with corrected trigger
UPDATE contas_receber 
SET updated_at = now() 
WHERE status IN ('pendente', 'vencido') 
  AND valor_aberto > 0;
