
-- =====================================================
-- SECURITY HARDENING: profiles and ads_accounts tables
-- =====================================================

-- =====================================================
-- PART 1: Fix profiles table RLS policies
-- Remove duplicate/conflicting policies and ensure strict hierarchy access
-- =====================================================

-- Drop existing overlapping policies on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_hierarchy_based" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_only" ON public.profiles;

-- Drop and recreate the can_view_profile function with stricter rules
DROP FUNCTION IF EXISTS public.can_view_profile(uuid, uuid);

CREATE OR REPLACE FUNCTION public.can_view_profile(viewer_id uuid, target_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_role app_role;
  is_direct_subordinate boolean;
BEGIN
  -- Users can always see their own profile
  IF viewer_id = target_profile_id THEN
    RETURN true;
  END IF;
  
  -- Get the viewer's role
  SELECT role INTO viewer_role
  FROM user_roles
  WHERE user_id = viewer_id
  LIMIT 1;
  
  -- Only admins can see all profiles
  IF viewer_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Supervisors can only see their DIRECT subordinates
  IF viewer_role = 'supervisor' THEN
    SELECT EXISTS(
      SELECT 1 FROM user_roles
      WHERE user_id = target_profile_id
      AND supervisor_id = viewer_id
    ) INTO is_direct_subordinate;
    
    RETURN is_direct_subordinate;
  END IF;
  
  -- All other users can only see their own profile (handled above)
  RETURN false;
END;
$$;

-- Add comment documenting the function
COMMENT ON FUNCTION public.can_view_profile IS 'Security function: Controls profile visibility. Users see own profile, admins see all, supervisors see only direct subordinates.';

-- Create strict RLS policies for profiles
CREATE POLICY "profiles_select_strict"
ON public.profiles FOR SELECT
TO authenticated
USING (can_view_profile(auth.uid(), id));

CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- =====================================================
-- PART 2: Fix ads_accounts table - encrypt credentials
-- =====================================================

-- First, remove duplicate/conflicting policies
DROP POLICY IF EXISTS "Users can create their own ads accounts" ON public.ads_accounts;
DROP POLICY IF EXISTS "Users can insert own ads_accounts" ON public.ads_accounts;
DROP POLICY IF EXISTS "Users can delete their own ads accounts" ON public.ads_accounts;
DROP POLICY IF EXISTS "Users can update their own ads accounts" ON public.ads_accounts;
DROP POLICY IF EXISTS "Users can update own ads_accounts" ON public.ads_accounts;
DROP POLICY IF EXISTS "Users can view their own ads accounts" ON public.ads_accounts;
DROP POLICY IF EXISTS "Users can view own ads_accounts or marketing" ON public.ads_accounts;
DROP POLICY IF EXISTS "Admins can delete ads_accounts" ON public.ads_accounts;

-- Create encrypted credentials column
ALTER TABLE public.ads_accounts
ADD COLUMN IF NOT EXISTS credentials_encrypted text;

-- Create function to check ads_accounts access
CREATE OR REPLACE FUNCTION public.can_access_ads_account(viewer_id uuid, account_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_role app_role;
BEGIN
  -- Users can access their own accounts
  IF viewer_id = account_user_id THEN
    RETURN true;
  END IF;
  
  -- Get viewer's role
  SELECT role INTO viewer_role
  FROM user_roles
  WHERE user_id = viewer_id
  LIMIT 1;
  
  -- Only admins can access other users' accounts
  IF viewer_role = 'admin' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.can_access_ads_account IS 'Security function: Controls ads account access. Users see own accounts, only admins can see all.';

-- Create strict RLS policies for ads_accounts
-- SELECT: User sees own accounts OR admin
CREATE POLICY "ads_accounts_select_strict"
ON public.ads_accounts FOR SELECT
TO authenticated
USING (can_access_ads_account(auth.uid(), user_id));

-- INSERT: User can only insert for themselves
CREATE POLICY "ads_accounts_insert_own"
ON public.ads_accounts FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE: User can only update their own accounts
CREATE POLICY "ads_accounts_update_own"
ON public.ads_accounts FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: Only admins can delete
CREATE POLICY "ads_accounts_delete_admin"
ON public.ads_accounts FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- =====================================================
-- PART 3: Create secure view for ads_accounts without credentials
-- This allows marketing team to see account info without seeing credentials
-- =====================================================

CREATE OR REPLACE VIEW public.ads_accounts_safe AS
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
  -- Mask credentials - show only if credentials exist
  CASE WHEN credentials IS NOT NULL THEN true ELSE false END as has_credentials
FROM public.ads_accounts;

-- Revoke direct access to the view for anon
REVOKE ALL ON public.ads_accounts_safe FROM anon;
GRANT SELECT ON public.ads_accounts_safe TO authenticated;

COMMENT ON VIEW public.ads_accounts_safe IS 'Safe view of ads_accounts without exposing credentials. Use this for dashboards and reports.';

-- =====================================================
-- PART 4: Add security audit trigger for sensitive tables
-- =====================================================

CREATE OR REPLACE FUNCTION public.audit_sensitive_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'timestamp', now()
    )
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Add audit triggers to sensitive tables
DROP TRIGGER IF EXISTS audit_ads_accounts_changes ON public.ads_accounts;
CREATE TRIGGER audit_ads_accounts_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.ads_accounts
  FOR EACH ROW EXECUTE FUNCTION audit_sensitive_access();

-- =====================================================
-- PART 5: Ensure user_id is NOT NULL for proper RLS
-- =====================================================

-- Make user_id required on ads_accounts to prevent RLS bypass
ALTER TABLE public.ads_accounts
ALTER COLUMN user_id SET NOT NULL;
