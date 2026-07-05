
-- =========================================================================
-- FIX A: guard nas 3 funções de dashboard (SECURITY DEFINER furando RLS)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.fn_cp_dashboard(
  p_empresa_ids integer[] DEFAULT NULL::integer[],
  p_data_de date DEFAULT NULL::date,
  p_data_ate date DEFAULT NULL::date,
  p_departamento uuid DEFAULT NULL::uuid,
  p_portadores text[] DEFAULT NULL::text[],
  p_centro_custo_id uuid DEFAULT NULL::uuid,
  p_plano_contas_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.check_user_access(auth.uid(), 'financeiro') THEN
    RAISE EXCEPTION 'acesso negado: modulo financeiro' USING ERRCODE = '42501';
  END IF;

  RETURN (
    WITH base AS (
      SELECT * FROM public.contas_pagar cp
      WHERE cp.status <> 'cancelado'
        AND public.user_has_empresa_access(auth.uid(), cp.empresa_id)
        AND (p_empresa_ids IS NULL OR cp.empresa_id = ANY(p_empresa_ids))
        AND (p_data_de   IS NULL OR cp.data_vencimento >= p_data_de)
        AND (p_data_ate  IS NULL OR cp.data_vencimento <= p_data_ate)
        AND (p_departamento IS NULL OR cp.departamento_id = p_departamento)
        AND (p_portadores IS NULL OR cp.portador = ANY(p_portadores))
        AND (p_centro_custo_id IS NULL OR cp.centro_custo_id = p_centro_custo_id)
        AND (p_plano_contas_id IS NULL OR cp.plano_contas_id = p_plano_contas_id)
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
      'por_status',          (SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) FROM (SELECT status, count(*) qtd, COALESCE(sum(valor_aberto),0) valor, COALESCE(sum(valor_original),0) AS valor_original FROM base GROUP BY status) x),
      'por_natureza',        (SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) FROM (SELECT natureza_lancamento, count(*) qtd, COALESCE(sum(valor_aberto),0) valor FROM base WHERE valor_aberto>0 GROUP BY natureza_lancamento) x),
      'top_fornecedores',    (SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) FROM (SELECT fornecedor_nome, COALESCE(sum(valor_original),0) valor, count(*) qtd FROM base WHERE fornecedor_nome IS NOT NULL GROUP BY fornecedor_nome ORDER BY 2 DESC LIMIT 10) x),
      'evolucao_mensal',     (SELECT COALESCE(jsonb_agg(x ORDER BY mes),'[]'::jsonb) FROM (SELECT to_char(date_trunc('month',data_vencimento),'YYYY-MM') mes, COALESCE(sum(valor_pago),0) pago, COALESCE(sum(valor_aberto),0) aberto, COALESCE(sum(valor_original),0) original FROM base GROUP BY 1) x),
      'por_departamento',    (SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) FROM (SELECT departamento_nome, COALESCE(sum(valor_original),0) valor FROM base GROUP BY departamento_nome ORDER BY 2 DESC LIMIT 8) x),
      'pago_mes_atual',      (SELECT COALESCE(sum(valor_pago),0) FROM base WHERE valor_aberto <= 0.005 AND data_pagamento BETWEEN date_trunc('month',current_date)::date AND (date_trunc('month',current_date) + interval '1 month - 1 day')::date)
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_cp_kpis_avancados(
  p_empresa_ids integer[] DEFAULT NULL::integer[],
  p_data_de date DEFAULT NULL::date,
  p_data_ate date DEFAULT NULL::date,
  p_departamento uuid DEFAULT NULL::uuid,
  p_portadores text[] DEFAULT NULL::text[],
  p_centro_custo_id uuid DEFAULT NULL::uuid,
  p_plano_contas_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.check_user_access(auth.uid(), 'financeiro') THEN
    RAISE EXCEPTION 'acesso negado: modulo financeiro' USING ERRCODE = '42501';
  END IF;

  RETURN (
    WITH base AS (
      SELECT * FROM public.contas_pagar cp
      WHERE cp.status <> 'cancelado'
        AND public.user_has_empresa_access(auth.uid(), cp.empresa_id)
        AND (p_empresa_ids IS NULL OR cp.empresa_id = ANY(p_empresa_ids))
        AND (p_data_de   IS NULL OR cp.data_vencimento >= p_data_de)
        AND (p_data_ate  IS NULL OR cp.data_vencimento <= p_data_ate)
        AND (p_departamento IS NULL OR cp.departamento_id = p_departamento)
        AND (p_portadores IS NULL OR cp.portador = ANY(p_portadores))
        AND (p_centro_custo_id IS NULL OR cp.centro_custo_id = p_centro_custo_id)
        AND (p_plano_contas_id IS NULL OR cp.plano_contas_id = p_plano_contas_id)
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
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_cp_calendario(
  p_empresa_ids integer[] DEFAULT NULL::integer[],
  p_data_de date DEFAULT NULL::date,
  p_data_ate date DEFAULT NULL::date,
  p_departamento uuid DEFAULT NULL::uuid,
  p_portadores text[] DEFAULT NULL::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.check_user_access(auth.uid(), 'financeiro') THEN
    RAISE EXCEPTION 'acesso negado: modulo financeiro' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(x ORDER BY dia),'[]'::jsonb) FROM (
      SELECT data_vencimento::date AS dia,
             count(*) qtd,
             COALESCE(sum(valor_aberto),0) valor_aberto,
             COALESCE(sum(valor_original),0) valor_original,
             COALESCE(sum(valor_pago),0) valor_pago
      FROM public.contas_pagar cp
      WHERE cp.status <> 'cancelado'
        AND cp.data_vencimento IS NOT NULL
        AND public.user_has_empresa_access(auth.uid(), cp.empresa_id)
        AND (p_empresa_ids IS NULL OR cp.empresa_id = ANY(p_empresa_ids))
        AND (p_data_de   IS NULL OR cp.data_vencimento >= p_data_de)
        AND (p_data_ate  IS NULL OR cp.data_vencimento <= p_data_ate)
        AND (p_departamento IS NULL OR cp.departamento_id = p_departamento)
        AND (p_portadores IS NULL OR cp.portador = ANY(p_portadores))
      GROUP BY data_vencimento::date
    ) x
  );
END;
$function$;

-- =========================================================================
-- FIX B: staging financeiras atrás do gate 'financeiro'
-- =========================================================================

DROP POLICY IF EXISTS erp_contas_pagar_rubysp_sel ON public.erp_contas_pagar_rubysp;
CREATE POLICY erp_contas_pagar_rubysp_sel ON public.erp_contas_pagar_rubysp
  FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro'));

DROP POLICY IF EXISTS erp_forn_rubysp_sel ON public.erp_fornecedores_rubysp;
CREATE POLICY erp_forn_rubysp_sel ON public.erp_fornecedores_rubysp
  FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro'));

DROP POLICY IF EXISTS erp_cp_enriq_rubysp_sel ON public.erp_cp_enriq_rubysp;
CREATE POLICY erp_cp_enriq_rubysp_sel ON public.erp_cp_enriq_rubysp
  FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro'));

DROP POLICY IF EXISTS cliente_financeiro_select ON public.cliente_financeiro;
CREATE POLICY cliente_financeiro_select ON public.cliente_financeiro
  FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro'));

DROP POLICY IF EXISTS erp_ccusto_rubysp_sel ON public.erp_ccusto_rubysp;
CREATE POLICY erp_ccusto_rubysp_sel ON public.erp_ccusto_rubysp
  FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro'));

DROP POLICY IF EXISTS erp_plano_contas_rubysp_sel ON public.erp_plano_contas_rubysp;
CREATE POLICY erp_plano_contas_rubysp_sel ON public.erp_plano_contas_rubysp
  FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro'));

-- =========================================================================
-- FIX C: revogar EXECUTE de PUBLIC nas funções de transform/enrich
-- =========================================================================

REVOKE ALL ON FUNCTION public.fn_transform_fornecedores_rubysp()      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_transform_ccusto_rubysp()            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_transform_plano_contas_rubysp()      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_transform_contas_pagar_rubysp()      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_enriquecer_contas_pagar_rubysp()     FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.fn_transform_fornecedores_rubysp()   TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_transform_ccusto_rubysp()         TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_transform_plano_contas_rubysp()   TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_transform_contas_pagar_rubysp()   TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_enriquecer_contas_pagar_rubysp()  TO service_role;

-- =========================================================================
-- FIX D: guard por alvo em solicitar_sync_rubysp
-- =========================================================================

CREATE OR REPLACE FUNCTION public.solicitar_sync_rubysp(p_alvo text)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE ts timestamptz := now();
BEGIN
  IF p_alvo = 'contas_pagar' AND NOT public.check_user_access(auth.uid(), 'financeiro') THEN
    RAISE EXCEPTION 'acesso negado: sync financeiro' USING ERRCODE = '42501';
  END IF;

  UPDATE public.sync_control_rubysp SET
    solicitar_pedidos_em      = CASE WHEN p_alvo IN ('pedidos','ambos')      THEN ts ELSE solicitar_pedidos_em      END,
    solicitar_historico_em    = CASE WHEN p_alvo IN ('historico','ambos')    THEN ts ELSE solicitar_historico_em    END,
    solicitar_contas_pagar_em = CASE WHEN p_alvo IN ('contas_pagar','ambos') THEN ts ELSE solicitar_contas_pagar_em END,
    updated_at = ts
  WHERE id = 1;

  RETURN ts;
END;
$function$;
