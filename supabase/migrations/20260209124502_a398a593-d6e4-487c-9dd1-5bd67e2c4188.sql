
-- Add new columns to trade_financial_entries
ALTER TABLE public.trade_financial_entries 
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS valor_previsto numeric NULL,
  ADD COLUMN IF NOT EXISTS category text NULL;

-- Create storage bucket for trade expense docs
INSERT INTO storage.buckets (id, name, public)
VALUES ('trade-expense-docs', 'trade-expense-docs', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for trade-expense-docs bucket
CREATE POLICY "Authenticated users can upload trade docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'trade-expense-docs');

CREATE POLICY "Trade docs are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'trade-expense-docs');

CREATE POLICY "Authenticated users can delete trade docs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'trade-expense-docs');

CREATE POLICY "Authenticated users can update trade docs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'trade-expense-docs');
