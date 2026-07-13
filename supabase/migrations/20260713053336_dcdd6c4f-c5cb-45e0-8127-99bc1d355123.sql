CREATE TABLE IF NOT EXISTS public.erp_estoque_fisico (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_result integer NOT NULL,
  data_foto date NOT NULL,
  produtos integer,
  unidades numeric(15,2),
  valor_ultimo_custo numeric(15,2),
  valor_custo_familia numeric(15,2),
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_result, data_foto)
);

CREATE INDEX IF NOT EXISTS idx_estoque_fisico_emp_data
  ON public.erp_estoque_fisico (empresa_result, data_foto);

GRANT SELECT ON public.erp_estoque_fisico TO authenticated;
GRANT ALL ON public.erp_estoque_fisico TO service_role;

ALTER TABLE public.erp_estoque_fisico ENABLE ROW LEVEL SECURITY;

CREATE POLICY erp_estoque_fisico_sel
  ON public.erp_estoque_fisico
  FOR SELECT
  TO authenticated
  USING (
    public.check_user_access(auth.uid(), 'compras'::text)
    OR public.check_user_access(auth.uid(), 'fornecedor'::text)
  );
