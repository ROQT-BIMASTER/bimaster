CREATE OR REPLACE FUNCTION public.fn_transform_ccusto_rubysp()
RETURNS TABLE (inseridos integer, atualizados integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_upd1 integer := 0; v_upd2 integer := 0; v_ins integer := 0;
BEGIN
  UPDATE public.centros_custo cc SET
    descricao = COALESCE(cc.descricao, s.descricao), updated_at = now()
  FROM public.erp_ccusto_rubysp s
  WHERE cc.erp_code = s.rubysp_ccusto_id::text;
  GET DIAGNOSTICS v_upd1 = ROW_COUNT;

  UPDATE public.centros_custo cc SET
    erp_code = s.rubysp_ccusto_id::text, updated_at = now()
  FROM public.erp_ccusto_rubysp s
  WHERE cc.erp_code IS NULL AND upper(btrim(cc.nome)) = upper(btrim(s.descricao));
  GET DIAGNOSTICS v_upd2 = ROW_COUNT;

  INSERT INTO public.centros_custo (nome, descricao, erp_code, status, empresa_id)
  SELECT DISTINCT ON (s.rubysp_ccusto_id)
    s.descricao, s.descricao, s.rubysp_ccusto_id::text, 'ATIVO', NULL
  FROM public.erp_ccusto_rubysp s
  WHERE NOT EXISTS (SELECT 1 FROM public.centros_custo cc WHERE cc.erp_code = s.rubysp_ccusto_id::text)
    AND NOT EXISTS (SELECT 1 FROM public.centros_custo cc WHERE upper(btrim(cc.nome)) = upper(btrim(s.descricao)))
  ORDER BY s.rubysp_ccusto_id;
  GET DIAGNOSTICS v_ins = ROW_COUNT;

  RETURN QUERY SELECT v_ins, (v_upd1 + v_upd2);
END $$;

GRANT EXECUTE ON FUNCTION public.fn_transform_ccusto_rubysp() TO service_role;