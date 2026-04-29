ALTER TABLE public.erp_estoque_distribuidora
  ADD COLUMN IF NOT EXISTS estoque_endereco numeric,
  ADD COLUMN IF NOT EXISTS estoque_bloqueado_produto numeric,
  ADD COLUMN IF NOT EXISTS estoque_bloqueado_endereco numeric,
  ADD COLUMN IF NOT EXISTS saldo_endereco numeric,
  ADD COLUMN IF NOT EXISTS pedido_pendente numeric,
  ADD COLUMN IF NOT EXISTS cod_fabricante text,
  ADD COLUMN IF NOT EXISTS nome_linha text,
  ADD COLUMN IF NOT EXISTS unidade_medida text,
  ADD COLUMN IF NOT EXISTS curva_fisica text,
  ADD COLUMN IF NOT EXISTS curva_monetaria text,
  ADD COLUMN IF NOT EXISTS data_ultima_compra date;

CREATE INDEX IF NOT EXISTS idx_erp_estoque_empresa_produto
  ON public.erp_estoque_distribuidora (empresa_par, cod_produto);

CREATE INDEX IF NOT EXISTS idx_erp_estoque_curva_monetaria
  ON public.erp_estoque_distribuidora (curva_monetaria);

CREATE INDEX IF NOT EXISTS idx_erp_estoque_saldo
  ON public.erp_estoque_distribuidora (saldo);

CREATE INDEX IF NOT EXISTS idx_erp_estoque_nome_linha
  ON public.erp_estoque_distribuidora (nome_linha);