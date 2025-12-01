-- Remover a foreign key antiga que aponta para fabrica_materias_primas
ALTER TABLE fabrica_precos_produtos 
DROP CONSTRAINT IF EXISTS fabrica_precos_produtos_produto_id_fkey;

-- Criar a foreign key correta apontando para fabrica_produtos
ALTER TABLE fabrica_precos_produtos
ADD CONSTRAINT fabrica_precos_produtos_produto_id_fkey 
FOREIGN KEY (produto_id) 
REFERENCES fabrica_produtos(id) 
ON DELETE CASCADE;

-- Comentário para documentação
COMMENT ON CONSTRAINT fabrica_precos_produtos_produto_id_fkey ON fabrica_precos_produtos 
IS 'Referencia produtos acabados na tabela fabrica_produtos';