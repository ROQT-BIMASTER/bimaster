CREATE OR REPLACE FUNCTION public.fn_transform_contas_pagar_rubysp()
 RETURNS TABLE(inseridos integer, atualizados integer, com_centro integer, com_plano integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '180s'
AS $function$
DECLARE v_upd integer := 0; v_ins integer := 0;
BEGIN
  UPDATE public.contas_pagar cp SET
    empresa_id          = s.empresa_id,
    tipo_documento      = s.tipo_documento,
    numero_documento    = s.numero_documento,
    parcela             = COALESCE(s.parcela, cp.parcela),
    fornecedor_codigo   = s.fornecedor_codigo,
    fornecedor_nome     = s.fornecedor_nome,
    valor_original      = s.valor_original,
    valor_aberto        = s.valor_aberto,
    valor_pago          = s.valor_pago,
    valor_juros         = s.valor_juros,
    valor_desconto      = s.valor_desconto,
    data_emissao        = s.data_emissao,
    data_vencimento     = s.data_vencimento,
    data_pagamento      = s.data_pagamento,
    categoria_codigo    = s.categoria_codigo,
    categoria_nome      = s.categoria_nome,
    portador            = s.portador,
    natureza_lancamento = CASE WHEN s.status_tpg = 0 THEN 'provisionado' ELSE 'lancado' END,
    centro_custo_id     = COALESCE(cc.id, cp.centro_custo_id),
    plano_contas_id     = COALESCE(tc.id, cp.plano_contas_id),
    updated_at          = now()
  FROM public.erp_contas_pagar_rubysp s
  LEFT JOIN public.centros_custo cc           ON cc.erp_code = s.custo_tpg::text
  LEFT JOIN public.trade_chart_of_accounts tc ON tc.erp_code = s.historico_tpg::text
  WHERE cp.erp_id = s.erp_id
    AND COALESCE(cp.importado_api, false) = false
    AND cp.codigo_integracao IS NULL;
  GET DIAGNOSTICS v_upd = ROW_COUNT;

  INSERT INTO public.contas_pagar (
    erp_id, empresa_id, tipo_documento, numero_documento, parcela,
    fornecedor_codigo, fornecedor_nome, valor_original, valor_aberto, valor_pago,
    valor_juros, valor_desconto, data_emissao, data_vencimento, data_pagamento,
    categoria_codigo, categoria_nome, portador,
    natureza_lancamento, centro_custo_id, plano_contas_id, importado_api
  )
  SELECT
    s.erp_id, s.empresa_id, s.tipo_documento, s.numero_documento, s.parcela,
    s.fornecedor_codigo, s.fornecedor_nome, s.valor_original, s.valor_aberto, s.valor_pago,
    s.valor_juros, s.valor_desconto, s.data_emissao, s.data_vencimento, s.data_pagamento,
    s.categoria_codigo, s.categoria_nome, s.portador,
    CASE WHEN s.status_tpg = 0 THEN 'provisionado' ELSE 'lancado' END,
    cc.id, tc.id, false
  FROM public.erp_contas_pagar_rubysp s
  LEFT JOIN public.centros_custo cc           ON cc.erp_code = s.custo_tpg::text
  LEFT JOIN public.trade_chart_of_accounts tc ON tc.erp_code = s.historico_tpg::text
  WHERE NOT EXISTS (SELECT 1 FROM public.contas_pagar cp WHERE cp.erp_id = s.erp_id)
  ON CONFLICT (erp_id) DO NOTHING;
  GET DIAGNOSTICS v_ins = ROW_COUNT;

  RETURN QUERY SELECT
    v_ins, v_upd,
    (SELECT count(*)::int FROM public.contas_pagar cp JOIN public.erp_contas_pagar_rubysp s ON cp.erp_id = s.erp_id WHERE cp.centro_custo_id IS NOT NULL),
    (SELECT count(*)::int FROM public.contas_pagar cp JOIN public.erp_contas_pagar_rubysp s ON cp.erp_id = s.erp_id WHERE cp.plano_contas_id IS NOT NULL);
END $function$;