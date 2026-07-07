
-- Staging: agregado autoritativo do ERP (empresa x mês)
CREATE TABLE IF NOT EXISTS public.erp_faturamento_rubysp (
  empresa_id integer NOT NULL,
  ano_mes text NOT NULL CHECK (ano_mes ~ '^\d{4}-\d{2}$'),
  faturamento_liquido numeric(18,2),
  vendas_brutas numeric(18,2),
  devolucoes numeric(18,2),
  n_notas integer,
  staged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, ano_mes)
);

GRANT ALL ON public.erp_faturamento_rubysp TO service_role;
ALTER TABLE public.erp_faturamento_rubysp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "faturamento_staging_deny_all"
  ON public.erp_faturamento_rubysp
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Tabela final
CREATE TABLE IF NOT EXISTS public.faturamento_mensal (
  empresa_id integer NOT NULL,
  ano_mes text NOT NULL CHECK (ano_mes ~ '^\d{4}-\d{2}$'),
  faturamento_liquido numeric(18,2),
  vendas_brutas numeric(18,2),
  devolucoes numeric(18,2),
  n_notas integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, ano_mes)
);

GRANT SELECT ON public.faturamento_mensal TO authenticated;
GRANT ALL ON public.faturamento_mensal TO service_role;
ALTER TABLE public.faturamento_mensal ENABLE ROW LEVEL SECURITY;

-- Espelha as regras de Contas a Pagar: precisa de acesso ao módulo financeiro + acesso à empresa
CREATE POLICY "faturamento_mensal_select_empresa"
  ON public.faturamento_mensal
  FOR SELECT
  TO authenticated
  USING (
    check_user_access((SELECT auth.uid()), 'financeiro'::text)
    AND user_has_empresa_access((SELECT auth.uid()), empresa_id)
  );

CREATE POLICY "faturamento_mensal_deny_anon_write"
  ON public.faturamento_mensal
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_faturamento_mensal_ano_mes ON public.faturamento_mensal (ano_mes);
CREATE INDEX IF NOT EXISTS idx_faturamento_mensal_empresa ON public.faturamento_mensal (empresa_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_faturamento_mensal_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_faturamento_mensal_updated_at ON public.faturamento_mensal;
CREATE TRIGGER trg_faturamento_mensal_updated_at
BEFORE UPDATE ON public.faturamento_mensal
FOR EACH ROW EXECUTE FUNCTION public.tg_faturamento_mensal_updated_at();

-- Função de transform (staging -> final)
CREATE OR REPLACE FUNCTION public.fn_transform_faturamento_rubysp()
RETURNS TABLE(inseridos integer, atualizados integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '60s'
AS $$
DECLARE v_ins integer := 0; v_upd integer := 0;
BEGIN
  WITH upsert AS (
    INSERT INTO public.faturamento_mensal AS f (
      empresa_id, ano_mes, faturamento_liquido, vendas_brutas, devolucoes, n_notas, updated_at
    )
    SELECT s.empresa_id, s.ano_mes, s.faturamento_liquido, s.vendas_brutas, s.devolucoes, s.n_notas, now()
    FROM public.erp_faturamento_rubysp s
    ON CONFLICT (empresa_id, ano_mes) DO UPDATE SET
      faturamento_liquido = EXCLUDED.faturamento_liquido,
      vendas_brutas       = EXCLUDED.vendas_brutas,
      devolucoes          = EXCLUDED.devolucoes,
      n_notas             = EXCLUDED.n_notas,
      updated_at          = now()
    RETURNING (xmax = 0) AS was_insert
  )
  SELECT
    COUNT(*) FILTER (WHERE was_insert),
    COUNT(*) FILTER (WHERE NOT was_insert)
  INTO v_ins, v_upd
  FROM upsert;

  RETURN QUERY SELECT v_ins, v_upd;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_transform_faturamento_rubysp() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_transform_faturamento_rubysp() TO service_role;
