
CREATE OR REPLACE FUNCTION public.fn_transform_contas_pagar_rubysp()
RETURNS TABLE(inseridos integer, atualizados integer, com_centro integer, com_plano integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_upd integer := 0; v_ins integer := 0;
BEGIN
  -- UPDATE
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
    setor_erp_id        = s.setor_tpg,
    setor_erp_nome      = s.setor_nome,
    -- plano_contas: aplicar resolver se não for classificação manual e se resolver devolveu algo
    plano_contas_id     = CASE
      WHEN COALESCE(cp.classificacao_manual,false) = true THEN cp.plano_contas_id
      WHEN rp.plano_contas_id IS NOT NULL THEN rp.plano_contas_id
      ELSE cp.plano_contas_id
    END,
    -- departamento: precedência setor_erp > mapa > mantém IA existente
    departamento_id     = CASE
      WHEN COALESCE(cp.classificacao_manual,false) = true THEN cp.departamento_id
      WHEN rd.departamento_id IS NOT NULL THEN rd.departamento_id
      ELSE cp.departamento_id
    END,
    departamento_origem = CASE
      WHEN COALESCE(cp.classificacao_manual,false) = true THEN 'manual'
      WHEN rd.origem IS NOT NULL THEN rd.origem
      WHEN cp.departamento_id IS NOT NULL THEN COALESCE(cp.departamento_origem, 'ia')
      ELSE cp.departamento_origem
    END,
    updated_at          = now()
  FROM public.erp_contas_pagar_rubysp s
  LEFT JOIN public.centros_custo cc ON cc.erp_code = s.custo_tpg::text
  LEFT JOIN LATERAL public.fn_resolve_plano_dre(s.custo_tpg, s.historico_tpg, NULL) rp ON true
  LEFT JOIN LATERAL public.fn_resolve_depto_dre(s.setor_tpg, s.custo_tpg, s.historico_tpg) rd ON true
  WHERE cp.erp_id = s.erp_id
    AND COALESCE(cp.importado_api, false) = false
    AND cp.codigo_integracao IS NULL;
  GET DIAGNOSTICS v_upd = ROW_COUNT;

  -- INSERT novos
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
    s.erp_id, s.empresa_id, s.tipo_documento, s.numero_documento, s.parcela,
    s.fornecedor_codigo, s.fornecedor_nome, s.valor_original, s.valor_aberto, s.valor_pago,
    s.valor_juros, s.valor_desconto, s.data_emissao, s.data_vencimento, s.data_pagamento,
    s.categoria_codigo, s.categoria_nome, s.portador,
    CASE WHEN s.status_tpg = 0 THEN 'provisionado' ELSE 'lancado' END,
    cc.id, rp.plano_contas_id,
    s.setor_tpg, s.setor_nome, rd.departamento_id, rd.origem,
    false
  FROM public.erp_contas_pagar_rubysp s
  LEFT JOIN public.centros_custo cc ON cc.erp_code = s.custo_tpg::text
  LEFT JOIN LATERAL public.fn_resolve_plano_dre(s.custo_tpg, s.historico_tpg, NULL) rp ON true
  LEFT JOIN LATERAL public.fn_resolve_depto_dre(s.setor_tpg, s.custo_tpg, s.historico_tpg) rd ON true
  WHERE NOT EXISTS (SELECT 1 FROM public.contas_pagar cp WHERE cp.erp_id = s.erp_id)
  ON CONFLICT (erp_id) DO NOTHING;
  GET DIAGNOSTICS v_ins = ROW_COUNT;

  RETURN QUERY SELECT
    v_ins, v_upd,
    (SELECT count(*)::int FROM public.contas_pagar cp JOIN public.erp_contas_pagar_rubysp s ON cp.erp_id = s.erp_id WHERE cp.centro_custo_id IS NOT NULL),
    (SELECT count(*)::int FROM public.contas_pagar cp JOIN public.erp_contas_pagar_rubysp s ON cp.erp_id = s.erp_id WHERE cp.plano_contas_id IS NOT NULL);
END
$$;
