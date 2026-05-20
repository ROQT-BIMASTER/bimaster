ALTER TABLE public.suporte_tickets
  ADD COLUMN IF NOT EXISTS categoria text;

CREATE INDEX IF NOT EXISTS idx_suporte_tickets_categoria
  ON public.suporte_tickets(categoria) WHERE categoria IS NOT NULL;