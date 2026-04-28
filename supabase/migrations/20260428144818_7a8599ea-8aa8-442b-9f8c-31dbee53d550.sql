
CREATE TABLE IF NOT EXISTS public.erp_estoque_distribuidora (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  erp_id text NOT NULL UNIQUE,
  empresa_par integer,
  abrev_par text,
  cod_produto integer,
  nome_prod text,
  saldo numeric(18,4) DEFAULT 0,
  custo_unitario numeric(18,4) DEFAULT 0,
  custo_total numeric(18,4) DEFAULT 0,
  valor_venda numeric(18,4) DEFAULT 0,
  validade date,
  lote text,
  localizacao text,
  raw jsonb,
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erp_estoque_empresa ON public.erp_estoque_distribuidora(empresa_par);
CREATE INDEX IF NOT EXISTS idx_erp_estoque_produto ON public.erp_estoque_distribuidora(cod_produto);
CREATE INDEX IF NOT EXISTS idx_erp_estoque_abrev ON public.erp_estoque_distribuidora(abrev_par);
CREATE INDEX IF NOT EXISTS idx_erp_estoque_synced ON public.erp_estoque_distribuidora(sincronizado_em DESC);

ALTER TABLE public.erp_estoque_distribuidora ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_erp_estoque_updated ON public.erp_estoque_distribuidora;
CREATE TRIGGER trg_erp_estoque_updated
  BEFORE UPDATE ON public.erp_estoque_distribuidora
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "erp_estoque_select_admin_gerente"
ON public.erp_estoque_distribuidora
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gerente'::app_role)
);

CREATE POLICY "erp_estoque_no_client_writes"
ON public.erp_estoque_distribuidora
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);
