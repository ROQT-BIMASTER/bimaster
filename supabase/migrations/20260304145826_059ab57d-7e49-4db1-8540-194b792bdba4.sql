
ALTER TABLE public.trade_financial_entries
  ADD COLUMN IF NOT EXISTS installment_group_id text,
  ADD COLUMN IF NOT EXISTS installment_number integer,
  ADD COLUMN IF NOT EXISTS installment_total integer,
  ADD COLUMN IF NOT EXISTS boleto_barcode text;

CREATE INDEX IF NOT EXISTS idx_trade_financial_entries_installment_group
  ON public.trade_financial_entries (installment_group_id)
  WHERE installment_group_id IS NOT NULL;
