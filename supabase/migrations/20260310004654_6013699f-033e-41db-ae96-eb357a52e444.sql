ALTER TABLE china_produto_cores
  ADD COLUMN IF NOT EXISTS cor_hex text,
  ADD COLUMN IF NOT EXISTS cor_numero text,
  ADD COLUMN IF NOT EXISTS ordem integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS codigo_barras_ean text,
  ADD COLUMN IF NOT EXISTS codigo_produto text,
  ADD COLUMN IF NOT EXISTS foto_url text;