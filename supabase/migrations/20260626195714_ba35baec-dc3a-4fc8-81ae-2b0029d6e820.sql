ALTER TABLE public.erp_vendas_item
  ADD COLUMN IF NOT EXISTS unidade_sigla text,
  ADD COLUMN IF NOT EXISTS itens_caixa   numeric,
  ADD COLUMN IF NOT EXISTS quantidade_un numeric;

COMMENT ON COLUMN public.erp_vendas_item.unidade_sigla IS 'Unidade comercial da NF-e (PRODUTO_UNIDADE.SIGLA): DZ=19, UN=1, CX=9/15.';
COMMENT ON COLUMN public.erp_vendas_item.itens_caixa  IS 'Fator de caixa (PRODUTO.ITENS_CAIXA) — unidades por caixa máster.';
COMMENT ON COLUMN public.erp_vendas_item.quantidade_un IS 'Quantidade canônica em UNIDADES. DZ×12 · CX/BX×itens_caixa · UN×1. Preserva quantidade original em quantidade.';