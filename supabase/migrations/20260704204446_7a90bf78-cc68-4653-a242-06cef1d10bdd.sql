
CREATE TABLE IF NOT EXISTS public.erp_cp_enriq_rubysp (
  erp_id           text PRIMARY KEY,
  status_tpg       integer,
  custo_tpg        integer,
  historico_tpg    bigint,
  sincronizado_em  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.erp_cp_enriq_rubysp TO authenticated;
GRANT ALL    ON public.erp_cp_enriq_rubysp TO service_role;

ALTER TABLE public.erp_cp_enriq_rubysp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "erp_cp_enriq_rubysp_sel" ON public.erp_cp_enriq_rubysp;
CREATE POLICY "erp_cp_enriq_rubysp_sel" ON public.erp_cp_enriq_rubysp
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.fn_enriquecer_contas_pagar_rubysp()
RETURNS TABLE (titulos_casados integer, provisionados_total integer, com_centro integer, com_plano integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_match integer;
BEGIN
  UPDATE public.contas_pagar cp SET
    natureza_lancamento = CASE WHEN s.status_tpg = 0 THEN 'provisionado' ELSE 'lancado' END,
    centro_custo_id     = COALESCE(cc.id, cp.centro_custo_id),
    plano_contas_id     = COALESCE(tc.id, cp.plano_contas_id),
    updated_at          = now()
  FROM public.erp_cp_enriq_rubysp s
  LEFT JOIN public.centros_custo cc           ON cc.erp_code = s.custo_tpg::text
  LEFT JOIN public.trade_chart_of_accounts tc ON tc.erp_code = s.historico_tpg::text
  WHERE cp.erp_id = s.erp_id;

  GET DIAGNOSTICS v_match = ROW_COUNT;

  RETURN QUERY SELECT
    v_match,
    (SELECT count(*)::int FROM public.contas_pagar WHERE natureza_lancamento = 'provisionado'),
    (SELECT count(*)::int FROM public.contas_pagar cp
       JOIN public.erp_cp_enriq_rubysp s ON cp.erp_id = s.erp_id
      WHERE cp.centro_custo_id IS NOT NULL),
    (SELECT count(*)::int FROM public.contas_pagar cp
       JOIN public.erp_cp_enriq_rubysp s ON cp.erp_id = s.erp_id
      WHERE cp.plano_contas_id IS NOT NULL);
END $$;

GRANT EXECUTE ON FUNCTION public.fn_enriquecer_contas_pagar_rubysp() TO service_role;
