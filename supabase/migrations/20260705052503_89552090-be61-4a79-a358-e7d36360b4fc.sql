CREATE OR REPLACE FUNCTION public.fn_cp_kpis_avancados(p_empresa_ids integer[] DEFAULT NULL::integer[], p_data_de date DEFAULT NULL::date, p_data_ate date DEFAULT NULL::date, p_departamento uuid DEFAULT NULL::uuid, p_portadores text[] DEFAULT NULL::text[], p_centro_custo_id uuid DEFAULT NULL::uuid, p_plano_contas_id uuid DEFAULT NULL::uuid)
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
      'pmp_dias_aprox',        (SELECT COALESCE(round(avg(data_pagamento - data_emissao))::int,0) FROM pagos WHERE (data_pagamento - data_emissao) BETWEEN 0 AND 180),
      'pontualidade_pct_aprox',(SELECT CASE WHEN count(*)>0 THEN round(100.0 * count(*) FILTER (WHERE data_pagamento <= data_vencimento)::numeric / count(*), 1) ELSE 0 END FROM pagos),
      'aproximado',            false,
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