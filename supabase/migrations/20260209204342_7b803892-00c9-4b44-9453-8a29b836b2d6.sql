
ALTER TABLE public.fabrica_mp_cotacoes
  ADD COLUMN custo_nf numeric NOT NULL DEFAULT 0,
  ADD COLUMN custo_servico numeric NOT NULL DEFAULT 0,
  ADD COLUMN custo_condicao numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.fabrica_mp_cotacoes.custo_nf IS 'Custo NF cotado pelo fornecedor';
COMMENT ON COLUMN public.fabrica_mp_cotacoes.custo_servico IS 'Custo Serviço cotado pelo fornecedor';
COMMENT ON COLUMN public.fabrica_mp_cotacoes.custo_condicao IS 'Custo Condição cotado pelo fornecedor';
