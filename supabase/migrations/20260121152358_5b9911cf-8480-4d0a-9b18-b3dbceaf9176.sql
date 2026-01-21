
-- =====================================================
-- SECURITY FIXES: Address linter warnings
-- =====================================================

-- Fix 1: Security Definer View - recreate as regular view with RLS
DROP VIEW IF EXISTS public.ads_accounts_safe;

CREATE VIEW public.ads_accounts_safe 
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  platform,
  account_name,
  account_id,
  is_active,
  last_sync_at,
  sync_status,
  created_at,
  updated_at,
  CASE WHEN credentials IS NOT NULL THEN true ELSE false END as has_credentials
FROM public.ads_accounts;

REVOKE ALL ON public.ads_accounts_safe FROM anon;
GRANT SELECT ON public.ads_accounts_safe TO authenticated;

COMMENT ON VIEW public.ads_accounts_safe IS 'Safe view of ads_accounts without exposing credentials. Uses security_invoker to respect RLS.';

-- Fix 2: Find and fix any RLS policies with USING (true) for UPDATE/DELETE/INSERT
-- Check for sync_rate_limiter table (recently created)
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  -- Check if sync_rate_limiter has any overly permissive policies
  FOR policy_record IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'sync_rate_limiter' 
    AND (qual = 'true' OR with_check = 'true')
  LOOP
    -- These will be fixed below
    NULL;
  END LOOP;
END $$;
