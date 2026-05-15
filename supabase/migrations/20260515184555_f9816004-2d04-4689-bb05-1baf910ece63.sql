ALTER TABLE public.fabrica_produtos
  ADD COLUMN IF NOT EXISTS is_provador boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_fabrica_produtos_is_provador
  ON public.fabrica_produtos(is_provador) WHERE is_provador = true;

COMMENT ON COLUMN public.fabrica_produtos.is_provador
  IS 'Marca o produto como amostra/provador (não vendável). Usado para filtrar precificação.';