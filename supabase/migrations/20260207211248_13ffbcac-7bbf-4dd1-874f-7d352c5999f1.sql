
ALTER TABLE public.financial_payment_queue
  ADD COLUMN IF NOT EXISTS receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMPTZ;
