-- Corrigir foreign key de produto_id na tabela fabrica_historico_precos
-- para referenciar fabrica_produtos ao invés de fabrica_materias_primas

-- Remover constraint antiga
ALTER TABLE fabrica_historico_precos
DROP CONSTRAINT IF EXISTS fabrica_historico_precos_produto_id_fkey;

-- Adicionar nova constraint referenciando fabrica_produtos
ALTER TABLE fabrica_historico_precos
ADD CONSTRAINT fabrica_historico_precos_produto_id_fkey
FOREIGN KEY (produto_id)
REFERENCES fabrica_produtos(id)
ON DELETE CASCADE;

COMMENT ON CONSTRAINT fabrica_historico_precos_produto_id_fkey 
ON fabrica_historico_precos 
IS 'Referencia produtos acabados na tabela fabrica_produtos';