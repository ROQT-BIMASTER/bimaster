-- Adicionar colunas para rastreabilidade da ficha de custo na tabela de preços
ALTER TABLE public.fabrica_precos_produtos 
ADD COLUMN IF NOT EXISTS ficha_custo_config_id uuid REFERENCES public.fabrica_produto_custos_config(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS custo_composicao jsonb;

-- Criar índice para melhor performance nas consultas
CREATE INDEX IF NOT EXISTS idx_fabrica_precos_produtos_ficha_custo 
ON public.fabrica_precos_produtos(ficha_custo_config_id) 
WHERE ficha_custo_config_id IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.fabrica_precos_produtos.ficha_custo_config_id IS 'ID da configuração da ficha de custo usada para gerar o preço';
COMMENT ON COLUMN public.fabrica_precos_produtos.custo_composicao IS 'Snapshot da composição detalhada do custo (insumos, M.O., markup)';