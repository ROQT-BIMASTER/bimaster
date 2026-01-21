-- Adicionar campos de limite de preço na tabela fabrica_produtos
ALTER TABLE fabrica_produtos 
ADD COLUMN IF NOT EXISTS preco_maximo NUMERIC,
ADD COLUMN IF NOT EXISTS preco_minimo NUMERIC;

-- Adicionar comentários para documentação
COMMENT ON COLUMN fabrica_produtos.preco_maximo IS 'Preço máximo permitido definido pela diretoria';
COMMENT ON COLUMN fabrica_produtos.preco_minimo IS 'Preço mínimo para garantir margem mínima';

-- Criar índice para consultas de produtos com limites definidos
CREATE INDEX IF NOT EXISTS idx_fabrica_produtos_preco_maximo ON fabrica_produtos(preco_maximo) WHERE preco_maximo IS NOT NULL;

-- Adicionar campo na tabela de preços para indicar se foi limitado
ALTER TABLE fabrica_precos_produtos 
ADD COLUMN IF NOT EXISTS preco_limitado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS preco_original_calculado NUMERIC,
ADD COLUMN IF NOT EXISTS motivo_limite TEXT;

-- Comentários
COMMENT ON COLUMN fabrica_precos_produtos.preco_limitado IS 'Indica se o preço foi ajustado para respeitar o limite máximo';
COMMENT ON COLUMN fabrica_precos_produtos.preco_original_calculado IS 'Preço que seria aplicado antes da limitação';
COMMENT ON COLUMN fabrica_precos_produtos.motivo_limite IS 'Motivo do ajuste de preço';