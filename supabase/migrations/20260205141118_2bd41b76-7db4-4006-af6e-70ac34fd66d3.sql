-- Fix RLS policies on financial_payment_queue to require authentication
DROP POLICY IF EXISTS "fpq_insert_policy" ON public.financial_payment_queue;
DROP POLICY IF EXISTS "fpq_update_policy" ON public.financial_payment_queue;

-- Create policies with proper authenticated role requirement
CREATE POLICY "fpq_insert_policy" ON public.financial_payment_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "fpq_update_policy" ON public.financial_payment_queue
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create audit table for expense approvals
CREATE TABLE IF NOT EXISTS public.expense_approval_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL,
  expense_type TEXT NOT NULL, -- 'department_expense', 'trade_entry', 'event_expense'
  action TEXT NOT NULL, -- 'approved', 'rejected', 'sent_to_financial', 'accepted', 'paid'
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  old_status TEXT,
  new_status TEXT,
  metadata JSONB
);

-- Enable RLS on audit table
ALTER TABLE public.expense_approval_audit ENABLE ROW LEVEL SECURITY;

-- Audit table policies - authenticated users can insert, only admins can view all
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.expense_approval_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view their own audit logs"
  ON public.expense_approval_audit
  FOR SELECT
  TO authenticated
  USING (performed_by = auth.uid());

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_expense_approval_audit_expense_id ON public.expense_approval_audit(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_approval_audit_performed_at ON public.expense_approval_audit(performed_at DESC);