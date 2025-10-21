-- Fix RLS policies for trade tables to restrict access to approved users only

-- 1. Fix stores table - restrict to approved users
DROP POLICY IF EXISTS "Usuários autenticados podem ver lojas" ON public.stores;
CREATE POLICY "Approved users can view stores"
ON public.stores FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND aprovado = true
  )
);

-- 2. Fix trade_bank_accounts - restrict to admin/supervisor only (financial data)
DROP POLICY IF EXISTS "Usuários autenticados podem ver contas correntes" ON public.trade_bank_accounts;
CREATE POLICY "Admin/supervisor view bank accounts"
ON public.trade_bank_accounts FOR SELECT
USING (is_admin_or_supervisor(auth.uid()));

-- 3. Fix trade_bank_transactions - restrict to admin/supervisor only (financial data)
DROP POLICY IF EXISTS "Usuários autenticados podem ver transações" ON public.trade_bank_transactions;
CREATE POLICY "Admin/supervisor view transactions"
ON public.trade_bank_transactions FOR SELECT
USING (is_admin_or_supervisor(auth.uid()));

-- 4. Fix municipios - restrict to approved users
DROP POLICY IF EXISTS "Everyone can view municipalities" ON public.municipios;
CREATE POLICY "Approved users can view municipalities"
ON public.municipios FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND aprovado = true
  )
);

-- 5. Add missing RLS policies for trade_financial_entries table
-- This table has RLS enabled but no policies, making it completely inaccessible

-- Allow admins and supervisors to manage all entries
CREATE POLICY "Admins e supervisores gerenciam lançamentos"
ON public.trade_financial_entries FOR ALL
USING (is_admin_or_supervisor(auth.uid()));

-- Allow users to view entries they created
CREATE POLICY "Usuários podem ver próprios lançamentos"
ON public.trade_financial_entries FOR SELECT
USING (created_by = auth.uid() OR is_admin_or_supervisor(auth.uid()));

-- Allow users to create entries
CREATE POLICY "Usuários podem criar lançamentos"
ON public.trade_financial_entries FOR INSERT
WITH CHECK (created_by = auth.uid());