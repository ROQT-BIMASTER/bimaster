
ALTER TABLE public.produto_brasil_skus
  ADD COLUMN IF NOT EXISTS cor_hex text,
  ADD COLUMN IF NOT EXISTS ordem integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS foto_url text;
