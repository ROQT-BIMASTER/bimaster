ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS observacao TEXT;

NOTIFY pgrst, 'reload schema';