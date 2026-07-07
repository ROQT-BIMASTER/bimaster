
CREATE INDEX IF NOT EXISTS idx_erp_dre_mapa_lookup
  ON public.erp_dre_mapa (ccusto_id, historico_id, prioridade, id);

CREATE OR REPLACE FUNCTION public.fn_transform_contas_pagar_rubysp()
RETURNS TABLE(inseridos integer, atualizados integer, com_centro integer, com_plano integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '10min'
AS $function$
DECLARE
  v_upd integer := 0;
  v_ins integer := 0;
BEGIN
  -- ============== UPDATE set-based ==============
  WITH resolved AS (
    SELECT
      s.erp_id,
      s.empresa_id,
      s.tipo_documento,
      s.numero_documento,
      s.parcela,
      s.fornecedor_codigo,
      s.fornecedor_nome,
      s.valor_original,
      s.valor_aberto,
      s.valor_pago,
      s.valor_juros,
      s.valor_desconto,
      s.data_emissao,
      s.data_vencimento,
      s.data_pagamento,
      s.categoria_codigo,
      s.categoria_nome,
      s.portador,
      s.status_tpg,
      s.setor_tpg,
      s.setor_nome,
      cc.id             AS centro_custo_id,
      t.id              AS plano_contas_id_resolvido,
      d.id              AS departamento_id_resolvido,
      sd.departamento   AS setor_departamento,
      r.departamento    AS mapa_departamento
    FROM public.erp_contas_pagar_rubysp s
    LEFT JOIN LATERAL (
      SELECT m.plano_code, m.departamento
      FROM public.erp_dre_mapa m
      WHERE (m.ccusto_id    IS NULL OR m.ccusto_id    = s.custo_tpg)
        AND (m.historico_id IS NULL OR m.historico_id = s.historico_tpg::int)
        AND  m.complemento_like IS NULL
      ORDER BY m.prioridade, m.id
      LIMIT 1
    ) r ON true
    LEFT JOIN public.erp_setor_depara sd
      ON sd.setor_id = s.setor_tpg AND s.setor_tpg > 0
    LEFT JOIN public.trade_chart_of_accounts t
      ON t.code = r.plano_code
    LEFT JOIN public.departamentos d
      ON d.nome = COALESCE(sd.departamento, r.departamento)
    LEFT JOIN public.centros_custo cc
      ON cc.erp_code = s.custo_tpg::text
  )
  UPDATE public.contas_pagar cp SET
    empresa_id          = rs.empresa_id,
    tipo_documento      = rs.tipo_documento,
    numero_documento    = rs.numero_documento,
    parcela             = COALESCE(rs.parcela, cp.parcela),
    fornecedor_codigo   = rs.fornecedor_codigo,
    fornecedor_nome     = rs.fornecedor_nome,
    valor_original      = rs.valor_original,
    valor_aberto        = rs.valor_aberto,
    valor_pago          = rs.valor_pago,
    valor_juros         = rs.valor_juros,
    valor_desconto      = rs.valor_desconto,
    data_emissao        = rs.data_emissao,
    data_vencimento     = rs.data_vencimento,
    data_pagamento      = rs.data_pagamento,
    categoria_codigo    = rs.categoria_codigo,
    categoria_nome      = rs.categoria_nome,
    portador            = rs.portador,
    natureza_lancamento = CASE WHEN rs.status_tpg = 0 THEN 'provisionado' ELSE 'lancado' END,
    centro_custo_id     = COALESCE(rs.centro_custo_id, cp.centro_custo_id),
    setor_erp_id        = rs.setor_tpg,
    setor_erp_nome      = rs.setor_nome,
    plano_contas_id     = CASE
      WHEN COALESCE(cp.classificacao_manual,false) THEN cp.plano_contas_id
      WHEN rs.plano_contas_id_resolvido IS NOT NULL THEN rs.plano_contas_id_resolvido
      ELSE cp.plano_contas_id
    END,
    departamento_id     = CASE
      WHEN COALESCE(cp.classificacao_manual,false) THEN cp.departamento_id
      WHEN rs.departamento_id_resolvido IS NOT NULL THEN rs.departamento_id_resolvido
      ELSE cp.departamento_id
    END,
    departamento_origem = CASE
      WHEN COALESCE(cp.classificacao_manual,false) THEN 'manual'
      WHEN rs.setor_departamento IS NOT NULL THEN 'setor_erp'
      WHEN rs.mapa_departamento  IS NOT NULL THEN 'mapa'
      WHEN cp.departamento_id IS NOT NULL THEN COALESCE(cp.departamento_origem, 'ia')
      ELSE cp.departamento_origem
    END,
    updated_at          = now()
  FROM resolved rs
  WHERE cp.erp_id = rs.erp_id
    AND COALESCE(cp.importado_api, false) = false
    AND cp.codigo_integracao IS NULL;
  GET DIAGNOSTICS v_upd = ROW_COUNT;

  -- ============== INSERT set-based ==============
  WITH resolved AS (
    SELECT
      s.*,
      cc.id             AS centro_custo_id_res,
      t.id              AS plano_contas_id_res,
      d.id              AS departamento_id_res,
      sd.departamento   AS setor_departamento,
      r.departamento    AS mapa_departamento
    FROM public.erp_contas_pagar_rubysp s
    LEFT JOIN LATERAL (
      SELECT m.plano_code, m.departamento
      FROM public.erp_dre_mapa m
      WHERE (m.ccusto_id    IS NULL OR m.ccusto_id    = s.custo_tpg)
        AND (m.historico_id IS NULL OR m.historico_id = s.historico_tpg::int)
        AND  m.complemento_like IS NULL
      ORDER BY m.prioridade, m.id
      LIMIT 1
    ) r ON true
    LEFT JOIN public.erp_setor_depara sd
      ON sd.setor_id = s.setor_tpg AND s.setor_tpg > 0
    LEFT JOIN public.trade_chart_of_accounts t
      ON t.code = r.plano_code
    LEFT JOIN public.departamentos d
      ON d.nome = COALESCE(sd.departamento, r.departamento)
    LEFT JOIN public.centros_custo cc
      ON cc.erp_code = s.custo_tpg::text
    WHERE NOT EXISTS (
      SELECT 1 FROM public.contas_pagar cp WHERE cp.erp_id = s.erp_id
    )
  )
  INSERT INTO public.contas_pagar (
    erp_id, empresa_id, tipo_documento, numero_documento, parcela,
    fornecedor_codigo, fornecedor_nome, valor_original, valor_aberto, valor_pago,
    valor_juros, valor_desconto, data_emissao, data_vencimento, data_pagamento,
    categoria_codigo, categoria_nome, portador,
    natureza_lancamento, centro_custo_id, plano_contas_id,
    setor_erp_id, setor_erp_nome, departamento_id, departamento_origem,
    importado_api
  )
  SELECT
    rs.erp_id, rs.empresa_id, rs.tipo_documento, rs.numero_documento, rs.parcela,
    rs.fornecedor_codigo, rs.fornecedor_nome, rs.valor_original, rs.valor_aberto, rs.valor_pago,
    rs.valor_juros, rs.valor_desconto, rs.data_emissao, rs.data_vencimento, rs.data_pagamento,
    rs.categoria_codigo, rs.categoria_nome, rs.portador,
    CASE WHEN rs.status_tpg = 0 THEN 'provisionado' ELSE 'lancado' END,
    rs.centro_custo_id_res, rs.plano_contas_id_res,
    rs.setor_tpg, rs.setor_nome, rs.departamento_id_res,
    CASE
      WHEN rs.setor_departamento IS NOT NULL THEN 'setor_erp'
      WHEN rs.mapa_departamento  IS NOT NULL THEN 'mapa'
      ELSE NULL
    END,
    false
  FROM resolved rs
  ON CONFLICT (erp_id) DO NOTHING;
  GET DIAGNOSTICS v_ins = ROW_COUNT;

  RETURN QUERY SELECT
    v_ins,
    v_upd,
    (SELECT count(*)::int FROM public.contas_pagar cp
       JOIN public.erp_contas_pagar_rubysp s ON cp.erp_id = s.erp_id
      WHERE cp.centro_custo_id IS NOT NULL),
    (SELECT count(*)::int FROM public.contas_pagar cp
       JOIN public.erp_contas_pagar_rubysp s ON cp.erp_id = s.erp_id
      WHERE cp.plano_contas_id IS NOT NULL);
END
$function$;
