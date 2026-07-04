
ALTER TABLE public.centros_custo
  ADD COLUMN IF NOT EXISTS erp_code text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_centros_custo_erp_code
  ON public.centros_custo (erp_code) WHERE erp_code IS NOT NULL;

COMMENT ON COLUMN public.centros_custo.erp_code IS
  'ID_CCus do ERP Result (catálogo global). Chave para casar Custo_tpg do Contas a Pagar.';

CREATE TABLE IF NOT EXISTS public.erp_ccusto_rubysp (
  rubysp_ccusto_id  bigint PRIMARY KEY,
  empresa_par       integer,
  descricao         text,
  tipo              integer,
  cod_contabil      text,
  apurar            boolean,
  raw               jsonb,
  sincronizado_em   timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.erp_ccusto_rubysp TO authenticated;
GRANT ALL    ON public.erp_ccusto_rubysp TO service_role;

ALTER TABLE public.erp_ccusto_rubysp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "erp_ccusto_rubysp_sel" ON public.erp_ccusto_rubysp;
CREATE POLICY "erp_ccusto_rubysp_sel" ON public.erp_ccusto_rubysp
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.fn_transform_ccusto_rubysp()
RETURNS TABLE (inseridos integer, atualizados integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_upd1 integer := 0; v_upd2 integer := 0; v_ins integer := 0;
BEGIN
  UPDATE public.centros_custo cc SET
    codigo     = COALESCE(NULLIF(s.cod_contabil,''), cc.codigo),
    descricao  = COALESCE(cc.descricao, s.descricao),
    updated_at = now()
  FROM public.erp_ccusto_rubysp s
  WHERE cc.erp_code = s.rubysp_ccusto_id::text;
  GET DIAGNOSTICS v_upd1 = ROW_COUNT;

  UPDATE public.centros_custo cc SET
    erp_code   = s.rubysp_ccusto_id::text,
    codigo     = COALESCE(NULLIF(s.cod_contabil,''), cc.codigo),
    updated_at = now()
  FROM public.erp_ccusto_rubysp s
  WHERE cc.erp_code IS NULL
    AND upper(btrim(cc.nome)) = upper(btrim(s.descricao));
  GET DIAGNOSTICS v_upd2 = ROW_COUNT;

  INSERT INTO public.centros_custo (nome, descricao, codigo, erp_code, status, empresa_id)
  SELECT DISTINCT ON (s.rubysp_ccusto_id)
    s.descricao, s.descricao, NULLIF(s.cod_contabil,''), s.rubysp_ccusto_id::text, 'ATIVO', NULL
  FROM public.erp_ccusto_rubysp s
  WHERE NOT EXISTS (SELECT 1 FROM public.centros_custo cc WHERE cc.erp_code = s.rubysp_ccusto_id::text)
    AND NOT EXISTS (SELECT 1 FROM public.centros_custo cc WHERE upper(btrim(cc.nome)) = upper(btrim(s.descricao)))
  ORDER BY s.rubysp_ccusto_id;
  GET DIAGNOSTICS v_ins = ROW_COUNT;

  RETURN QUERY SELECT v_ins, (v_upd1 + v_upd2);
END $$;

GRANT EXECUTE ON FUNCTION public.fn_transform_ccusto_rubysp() TO service_role;
