-- Adicionar campo origem aos produtos
ALTER TABLE fabrica_produtos 
ADD COLUMN IF NOT EXISTS origem VARCHAR(20) DEFAULT 'nacional' 
CHECK (origem IN ('nacional', 'importado'));

-- Comentário para documentação
COMMENT ON COLUMN fabrica_produtos.origem IS 'Origem do produto: nacional ou importado - afeta cálculo de custos';

-- Criar índice para filtros
CREATE INDEX IF NOT EXISTS idx_fabrica_produtos_origem ON fabrica_produtos(origem);