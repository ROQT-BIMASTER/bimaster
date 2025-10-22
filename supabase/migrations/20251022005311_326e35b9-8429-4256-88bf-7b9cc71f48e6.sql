-- Fix overly permissive RLS policies for bank transactions and accounts
-- Restrict access to admin/supervisor or users managing specific stores

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Usuários autenticados podem ver transações" ON trade_bank_transactions;
DROP POLICY IF EXISTS "Usuários autenticados podem ver contas correntes" ON trade_bank_accounts;

-- Create secure policy for trade_bank_transactions SELECT
-- Users can only see transactions for stores they created, or admin/supervisor see all
CREATE POLICY "Users see transactions for managed stores"
ON trade_bank_transactions FOR SELECT
USING (
  is_admin_or_supervisor(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM trade_bank_accounts tba
    JOIN stores s ON tba.store_id = s.id
    WHERE tba.id = trade_bank_transactions.bank_account_id
    AND s.created_by = auth.uid()
  )
);

-- Create secure policy for trade_bank_accounts SELECT
-- Users can only see accounts for stores they created, or admin/supervisor see all
CREATE POLICY "Users see accounts for managed stores"
ON trade_bank_accounts FOR SELECT
USING (
  is_admin_or_supervisor(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM stores s
    WHERE s.id = trade_bank_accounts.store_id
    AND s.created_by = auth.uid()
  )
);