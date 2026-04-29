-- Tabela espelho da view ComposicaoProduto do ERP
CREATE TABLE IF NOT EXISTS public.erp_composicao_produto (
  erp_id text PRIMARY KEY,
  empresa_compo integer NOT NULL,
  produto_compo integer NOT NULL,
  materia_compo integer NOT NULL,
  quantidade_compo numeric(18,6),
  raw jsonb,
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erp_composicao_empresa ON public.erp_composicao_produto(empresa_compo);
CREATE INDEX IF NOT EXISTS idx_erp_composicao_produto ON public.erp_composicao_produto(produto_compo);
CREATE INDEX IF NOT EXISTS idx_erp_composicao_materia ON public.erp_composicao_produto(materia_compo);
CREATE INDEX IF NOT EXISTS idx_erp_composicao_emp_prod ON public.erp_composicao_produto(empresa_compo, produto_compo);

ALTER TABLE public.erp_composicao_produto ENABLE ROW LEVEL SECURITY;

-- Leitura: usuário precisa ter acesso à empresa via user_empresas (mesmo padrão do estoque)
CREATE POLICY "erp_composicao_select_by_empresa"
ON public.erp_composicao_produto
FOR SELECT
TO authenticated
USING (
  empresa_compo IN (
    SELECT ue.empresa_id FROM public.user_empresas ue WHERE ue.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- Escrita restrita ao service role (engine)
CREATE POLICY "erp_composicao_service_write"
ON public.erp_composicao_produto
FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER trg_erp_composicao_updated_at
BEFORE UPDATE ON public.erp_composicao_produto
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();