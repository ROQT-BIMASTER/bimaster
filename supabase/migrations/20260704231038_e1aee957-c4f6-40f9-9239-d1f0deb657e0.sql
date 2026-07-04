
-- =========================================================
-- fn_cp_dashboard: KPIs principais para o painel de Contas a Pagar
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_cp_dashboard(
  p_empresa_ids  integer[] DEFAULT NULL,
  p_data_de      date DEFAULT NULL,
  p_data_ate     date DEFAULT NULL,
  p_departamento uuid DEFAULT NULL,
  p_portadores   text[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT * FROM public.contas_pagar cp
    WHERE cp.status <> 'cancelado'
      AND (p_empresa_ids IS NULL OR cp.empresa_id = ANY(p_empresa_ids))
      AND (p_data_de   IS NULL OR cp.data_vencimento >= p_data_de)
      AND (p_data_ate  IS NULL OR cp.data_vencimento <= p_data_ate)
      AND (p_departamento IS NULL OR cp.departamento_id = p_departamento)
      AND (p_portadores IS NULL OR cp.portador = ANY(p_portadores))
  )
  SELECT jsonb_build_object(
    'provisionado_aberto', (SELECT COALESCE(sum(valor_aberto),0) FROM base WHERE natureza_lancamento='provisionado' AND valor_aberto>0),
    'lancado_aberto',      (SELECT COALESCE(sum(valor_aberto),0) FROM base WHERE natureza_lancamento='lancado' AND valor_aberto>0),
    'total_aberto',        (SELECT COALESCE(sum(valor_aberto),0) FROM base WHERE valor_aberto>0),
    'qtd_aberto',          (SELECT count(*) FROM base WHERE valor_aberto>0),
    'vence_hoje',          (SELECT jsonb_build_object('qtd',count(*),'valor',COALESCE(sum(valor_aberto),0)) FROM base WHERE valor_aberto>0 AND data_vencimento=current_date),
    'vence_7d',            (SELECT jsonb_build_object('qtd',count(*),'valor',COALESCE(sum(valor_aberto),0)) FROM base WHERE valor_aberto>0 AND data_vencimento BETWEEN current_date AND current_date+7),
    'vence_30d',           (SELECT jsonb_build_object('qtd',count(*),'valor',COALESCE(sum(valor_aberto),0)) FROM base WHERE valor_aberto>0 AND data_vencimento BETWEEN current_date AND current_date+30),
    'vencido_30_mais',     (SELECT jsonb_build_object('qtd',count(*),'valor',COALESCE(sum(valor_aberto),0)) FROM base WHERE valor_aberto>0 AND data_vencimento < current_date-30),
    'vencido_total',       (SELECT jsonb_build_object('qtd',count(*),'valor',COALESCE(sum(valor_aberto),0)) FROM base WHERE valor_aberto>0 AND data_vencimento < current_date),
    'por_status',          (SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) FROM (SELECT status, count(*) qtd, COALESCE(sum(valor_aberto),0) valor FROM base GROUP BY status) x),
    'por_natureza',        (SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) FROM (SELECT natureza_lancamento, count(*) qtd, COALESCE(sum(valor_aberto),0) valor FROM base WHERE valor_aberto>0 GROUP BY natureza_lancamento) x),
    'top_fornecedores',    (SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) FROM (SELECT fornecedor_nome, COALESCE(sum(valor_original),0) valor, count(*) qtd FROM base WHERE fornecedor_nome IS NOT NULL GROUP BY fornecedor_nome ORDER BY 2 DESC LIMIT 10) x),
    'evolucao_mensal',     (SELECT COALESCE(jsonb_agg(x ORDER BY mes),'[]'::jsonb) FROM (SELECT to_char(date_trunc('month',data_vencimento),'YYYY-MM') mes, COALESCE(sum(valor_pago),0) pago, COALESCE(sum(valor_aberto),0) aberto, COALESCE(sum(valor_original),0) original FROM base GROUP BY 1) x)
  );
$$;

GRANT EXECUTE ON FUNCTION public.fn_cp_dashboard(integer[],date,date,uuid,text[]) TO authenticated;

-- =========================================================
-- fn_cp_kpis_avancados: PMP / pontualidade (aproximados até Fase 2b) + concentração + comparativo mensal
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_cp_kpis_avancados(
  p_empresa_ids  integer[] DEFAULT NULL,
  p_data_de      date DEFAULT NULL,
  p_data_ate     date DEFAULT NULL,
  p_departamento uuid DEFAULT NULL,
  p_portadores   text[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT * FROM public.contas_pagar cp
    WHERE cp.status <> 'cancelado'
      AND (p_empresa_ids IS NULL OR cp.empresa_id = ANY(p_empresa_ids))
      AND (p_data_de   IS NULL OR cp.data_vencimento >= p_data_de)
      AND (p_data_ate  IS NULL OR cp.data_vencimento <= p_data_ate)
      AND (p_departamento IS NULL OR cp.departamento_id = p_departamento)
      AND (p_portadores IS NULL OR cp.portador = ANY(p_portadores))
  ),
  pagos AS (
    SELECT * FROM base WHERE data_pagamento IS NOT NULL AND data_emissao IS NOT NULL
  ),
  mes_atual AS (
    SELECT COALESCE(sum(valor_aberto),0) v FROM base
    WHERE valor_aberto>0 AND data_vencimento BETWEEN date_trunc('month',current_date)::date AND (date_trunc('month',current_date) + interval '1 month - 1 day')::date
  ),
  mes_anterior AS (
    SELECT COALESCE(sum(valor_aberto),0) v FROM base
    WHERE valor_aberto>0 AND data_vencimento BETWEEN (date_trunc('month',current_date) - interval '1 month')::date AND (date_trunc('month',current_date) - interval '1 day')::date
  )
  SELECT jsonb_build_object(
    'pmp_dias_aprox',        (SELECT COALESCE(round(avg(data_pagamento - data_emissao))::int,0) FROM pagos),
    'pontualidade_pct_aprox',(SELECT CASE WHEN count(*)>0 THEN round(100.0 * count(*) FILTER (WHERE data_pagamento <= data_vencimento)::numeric / count(*), 1) ELSE 0 END FROM pagos),
    'aproximado',            true,
    'concentracao_7d',       (SELECT COALESCE(sum(valor_aberto),0) FROM base WHERE valor_aberto>0 AND data_vencimento BETWEEN current_date AND current_date+7),
    'concentracao_15d',      (SELECT COALESCE(sum(valor_aberto),0) FROM base WHERE valor_aberto>0 AND data_vencimento BETWEEN current_date AND current_date+15),
    'concentracao_30d',      (SELECT COALESCE(sum(valor_aberto),0) FROM base WHERE valor_aberto>0 AND data_vencimento BETWEEN current_date AND current_date+30),
    'total_mes_atual',       (SELECT v FROM mes_atual),
    'total_mes_anterior',    (SELECT v FROM mes_anterior),
    'variacao_mensal_pct',   (SELECT CASE WHEN (SELECT v FROM mes_anterior)>0 THEN round(100.0 * ((SELECT v FROM mes_atual) - (SELECT v FROM mes_anterior)) / (SELECT v FROM mes_anterior), 1) ELSE 0 END)
  );
$$;

GRANT EXECUTE ON FUNCTION public.fn_cp_kpis_avancados(integer[],date,date,uuid,text[]) TO authenticated;

-- =========================================================
-- fn_cp_calendario: agregação diária para a visão calendário
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_cp_calendario(
  p_empresa_ids  integer[] DEFAULT NULL,
  p_data_de      date DEFAULT NULL,
  p_data_ate     date DEFAULT NULL,
  p_departamento uuid DEFAULT NULL,
  p_portadores   text[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(x ORDER BY dia),'[]'::jsonb) FROM (
    SELECT data_vencimento::date AS dia,
           count(*) qtd,
           COALESCE(sum(valor_aberto),0) valor_aberto,
           COALESCE(sum(valor_original),0) valor_original,
           COALESCE(sum(valor_pago),0) valor_pago
    FROM public.contas_pagar cp
    WHERE cp.status <> 'cancelado'
      AND cp.data_vencimento IS NOT NULL
      AND (p_empresa_ids IS NULL OR cp.empresa_id = ANY(p_empresa_ids))
      AND (p_data_de   IS NULL OR cp.data_vencimento >= p_data_de)
      AND (p_data_ate  IS NULL OR cp.data_vencimento <= p_data_ate)
      AND (p_departamento IS NULL OR cp.departamento_id = p_departamento)
      AND (p_portadores IS NULL OR cp.portador = ANY(p_portadores))
    GROUP BY data_vencimento::date
  ) x;
$$;

GRANT EXECUTE ON FUNCTION public.fn_cp_calendario(integer[],date,date,uuid,text[]) TO authenticated;
