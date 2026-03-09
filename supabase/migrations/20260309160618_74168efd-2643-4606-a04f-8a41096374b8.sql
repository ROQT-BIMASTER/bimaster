ALTER TABLE public.financial_payment_queue
ADD COLUMN IF NOT EXISTS rejection_category text,
ADD COLUMN IF NOT EXISTS rejection_fields jsonb DEFAULT '[]'::jsonb;