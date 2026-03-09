ALTER TABLE public.financial_payment_queue 
ADD COLUMN IF NOT EXISTS payment_method text,
ADD COLUMN IF NOT EXISTS payment_details jsonb DEFAULT '{}'::jsonb;