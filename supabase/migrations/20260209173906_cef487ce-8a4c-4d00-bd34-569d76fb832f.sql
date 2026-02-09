
-- Add base_calculo_markup column to fabrica_produto_custos_config
-- Options: 'total' (NF+Serviço+Condição), 'nf' (only NF), 'servico' (only Serviço)
ALTER TABLE public.fabrica_produto_custos_config
ADD COLUMN base_calculo_markup text NOT NULL DEFAULT 'total';
