
ALTER TABLE corporate_event_expenses
  ADD COLUMN IF NOT EXISTS installment_group_id text,
  ADD COLUMN IF NOT EXISTS installment_number integer,
  ADD COLUMN IF NOT EXISTS installment_total integer,
  ADD COLUMN IF NOT EXISTS boleto_barcode text;

ALTER TABLE department_expenses
  ADD COLUMN IF NOT EXISTS installment_group_id text,
  ADD COLUMN IF NOT EXISTS installment_number integer,
  ADD COLUMN IF NOT EXISTS installment_total integer,
  ADD COLUMN IF NOT EXISTS boleto_barcode text;
