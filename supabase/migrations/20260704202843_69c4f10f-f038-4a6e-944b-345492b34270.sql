
CREATE OR REPLACE FUNCTION public.fn_transform_plano_contas_rubysp()
RETURNS TABLE (inseridos integer, atualizados integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_upd1 integer := 0; v_upd2 integer := 0; v_ins integer := 0;
BEGIN
  UPDATE public.trade_chart_of_accounts t SET
    erp_sync_status = 'synced', erp_synced_at = now(), updated_at = now()
  FROM public.erp_plano_contas_rubysp s
  WHERE t.erp_code = s.rubysp_hist_id::text;
  GET DIAGNOSTICS v_upd1 = ROW_COUNT;

  UPDATE public.trade_chart_of_accounts t SET
    erp_code = s.rubysp_hist_id::text, erp_sync_status = 'synced', erp_synced_at = now(), updated_at = now()
  FROM public.erp_plano_contas_rubysp s
  WHERE t.erp_code IS NULL
    AND upper(btrim(t.name)) = upper(btrim(s.descricao));
  GET DIAGNOSTICS v_upd2 = ROW_COUNT;

  INSERT INTO public.trade_chart_of_accounts
    (account_type, code, name, natureza, erp_code, permite_lancamento, is_group, is_active, erp_sync_status, erp_synced_at)
  SELECT DISTINCT ON (s.rubysp_hist_id)
    CASE WHEN s.tipo = 1 THEN 'revenue' ELSE 'expense' END,
    'RES-' || s.rubysp_hist_id::text,
    s.descricao,
    CASE WHEN s.tipo = 1 THEN 'C' ELSE 'D' END,
    s.rubysp_hist_id::text,
    true, false, true, 'synced', now()
  FROM public.erp_plano_contas_rubysp s
  WHERE NOT EXISTS (SELECT 1 FROM public.trade_chart_of_accounts t WHERE t.erp_code = s.rubysp_hist_id::text)
    AND NOT EXISTS (SELECT 1 FROM public.trade_chart_of_accounts t WHERE upper(btrim(t.name)) = upper(btrim(s.descricao)))
  ORDER BY s.rubysp_hist_id;
  GET DIAGNOSTICS v_ins = ROW_COUNT;

  RETURN QUERY SELECT v_ins, (v_upd1 + v_upd2);
END $$;

GRANT EXECUTE ON FUNCTION public.fn_transform_plano_contas_rubysp() TO service_role;
