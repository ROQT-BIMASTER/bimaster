-- Add bank data columns to stores table for payment processing
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS banco TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS agencia TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS conta TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS tipo_conta TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS pix_chave TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS pix_tipo TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS favorecido TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS linha_digitavel TEXT;