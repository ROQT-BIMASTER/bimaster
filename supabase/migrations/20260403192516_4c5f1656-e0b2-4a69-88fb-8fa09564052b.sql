
-- Fix: restrict insert to service role only
DROP POLICY IF EXISTS "Service role can insert sync_metrics" ON public.sync_metrics;

-- Revoke API access to materialized view
REVOKE ALL ON public.mv_financeiro_dashboard FROM anon, authenticated;
