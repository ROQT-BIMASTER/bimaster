
CREATE TABLE IF NOT EXISTS public.erp_compras_result (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_result integer NOT NULL,
  fornecedor_nome text,
  fornecedor_cnpj text,
  numero_nota text NOT NULL,
  serie text,
  chave_nfe text,
  data_emissao date,
  data_entrada date NOT NULL,
  cfop integer NOT NULL,
  cst text,
  classe text NOT NULL CHECK (classe IN ('revenda','uso_consumo','devolucao_venda','transferencia','outros')),
  valor_contabil numeric(15,2),
  base_icms numeric(15,2),
  valor_icms numeric(15,2),
  base_st numeric(15,2),
  valor_st numeric(15,2),
  valor_ipi numeric(15,2),
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT erp_compras_result_uk UNIQUE (empresa_result, numero_nota, cfop, cst, data_entrada)
);

GRANT SELECT ON public.erp_compras_result TO authenticated;
GRANT ALL ON public.erp_compras_result TO service_role;

ALTER TABLE public.erp_compras_result ENABLE ROW LEVEL SECURITY;

CREATE POLICY erp_compras_result_sel ON public.erp_compras_result
FOR SELECT TO authenticated
USING (
  public.check_user_access(auth.uid(), 'compras')
  OR public.check_user_access(auth.uid(), 'fornecedor')
);

CREATE INDEX IF NOT EXISTS idx_compras_result_emp_data ON public.erp_compras_result (empresa_result, data_entrada);
CREATE INDEX IF NOT EXISTS idx_compras_result_classe ON public.erp_compras_result (classe);
CREATE INDEX IF NOT EXISTS idx_compras_result_cnpj ON public.erp_compras_result (fornecedor_cnpj);

CREATE TABLE IF NOT EXISTS public.erp_compras_vendas_mensal (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_result integer NOT NULL,
  mes date NOT NULL,
  compras_revenda numeric(15,2),
  compras_uso_consumo numeric(15,2),
  devolucoes_venda numeric(15,2),
  transferencias numeric(15,2),
  vendas_preco numeric(15,2),
  vendas_ultimo_custo numeric(15,2),
  vendas_custo_familia numeric(15,2),
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT erp_compras_vendas_mensal_uk UNIQUE (empresa_result, mes)
);

GRANT SELECT ON public.erp_compras_vendas_mensal TO authenticated;
GRANT ALL ON public.erp_compras_vendas_mensal TO service_role;

ALTER TABLE public.erp_compras_vendas_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY erp_compras_vendas_mensal_sel ON public.erp_compras_vendas_mensal
FOR SELECT TO authenticated
USING (
  public.check_user_access(auth.uid(), 'compras')
  OR public.check_user_access(auth.uid(), 'fornecedor')
);
