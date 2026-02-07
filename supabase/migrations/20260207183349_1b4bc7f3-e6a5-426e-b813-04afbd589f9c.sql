
-- Fix: stores_insert should require authentication
DROP POLICY IF EXISTS "stores_insert" ON public.stores;
CREATE POLICY "stores_insert" ON public.stores FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Fix: trade_campaign_audit_log insert should require authentication
DROP POLICY IF EXISTS "tcal_insert" ON public.trade_campaign_audit_log;
CREATE POLICY "tcal_insert" ON public.trade_campaign_audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
