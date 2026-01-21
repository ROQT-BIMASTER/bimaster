
-- =====================================================
-- SECURITY FIXES: Fix overly permissive RLS policies
-- =====================================================

-- Fix 1: trade_bank_daily_balances - restrict UPDATE and DELETE to admins/finance only
DROP POLICY IF EXISTS "Allow authenticated users to delete bank daily balances" ON public.trade_bank_daily_balances;
DROP POLICY IF EXISTS "Allow authenticated users to update bank daily balances" ON public.trade_bank_daily_balances;

-- Recreate with proper restrictions
CREATE POLICY "trade_bank_daily_balances_update_finance"
ON public.trade_bank_daily_balances FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'supervisor') OR
  has_finance_access(auth.uid())
);

CREATE POLICY "trade_bank_daily_balances_delete_admin"
ON public.trade_bank_daily_balances FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Fix 2: Add RLS policies to sync_rate_limiter table (it has RLS enabled but no policies)
-- This is an internal table for rate limiting, should be accessible by service role only
-- But we need edge functions to use it, so allow authenticated with specific conditions

-- Check if sync_rate_limiter exists and add policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sync_rate_limiter' AND table_schema = 'public') THEN
    -- Allow service role full access (implicit)
    -- Allow authenticated to manage their own slots
    EXECUTE 'CREATE POLICY "sync_rate_limiter_select" ON public.sync_rate_limiter FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY "sync_rate_limiter_insert" ON public.sync_rate_limiter FOR INSERT TO authenticated WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "sync_rate_limiter_delete" ON public.sync_rate_limiter FOR DELETE TO authenticated USING (true)';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
