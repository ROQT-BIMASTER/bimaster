
ALTER TABLE corporate_event_expenses
  ADD COLUMN IF NOT EXISTS payment_queue_id uuid REFERENCES financial_payment_queue(id);

ALTER TABLE department_expenses
  ADD COLUMN IF NOT EXISTS payment_queue_id uuid REFERENCES financial_payment_queue(id);
