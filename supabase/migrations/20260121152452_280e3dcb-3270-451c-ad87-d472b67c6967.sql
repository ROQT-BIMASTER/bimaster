
-- =====================================================
-- SECURITY FIX: sync_rate_limiter table
-- This is an INTERNAL table used only by edge functions via service_role
-- Disable RLS since edge functions bypass it with service_role anyway
-- =====================================================

-- Remove the problematic RLS policies
DROP POLICY IF EXISTS "sync_rate_limiter_select" ON public.sync_rate_limiter;
DROP POLICY IF EXISTS "sync_rate_limiter_insert" ON public.sync_rate_limiter;
DROP POLICY IF EXISTS "sync_rate_limiter_delete" ON public.sync_rate_limiter;

-- Disable RLS on this internal table - it's only accessed via service_role in edge functions
ALTER TABLE public.sync_rate_limiter DISABLE ROW LEVEL SECURITY;

-- Revoke all access from anon and authenticated - only service_role should access this
REVOKE ALL ON public.sync_rate_limiter FROM anon;
REVOKE ALL ON public.sync_rate_limiter FROM authenticated;

-- Grant access only to service_role (implicit for tables, but being explicit)
GRANT ALL ON public.sync_rate_limiter TO service_role;

-- Add comment explaining this is an internal table
COMMENT ON TABLE public.sync_rate_limiter IS 'Internal table for rate limiting API sync operations. Accessed only by edge functions via service_role.';
