ALTER TABLE public.fabrica_produto_custos
  ADD COLUMN IF NOT EXISTS ipi_valor numeric(15,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ipi_percentual numeric(7,4) DEFAULT 0;