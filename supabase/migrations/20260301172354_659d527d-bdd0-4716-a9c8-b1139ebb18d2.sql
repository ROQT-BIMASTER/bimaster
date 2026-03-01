
ALTER TABLE fabrica_produtos ADD COLUMN IF NOT EXISTS tipo_rotulagem text;
ALTER TABLE fabrica_produto_grade_itens ADD COLUMN IF NOT EXISTS cor_numero text;
