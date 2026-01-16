
-- Fix profiles table: Remove public policies and ensure only authenticated access
DROP POLICY IF EXISTS "profiles_select_restricted" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_restricted" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_restricted" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin_only" ON public.profiles;

-- Fix contas_receber table: Remove public policy
DROP POLICY IF EXISTS "contas_receber_select" ON public.contas_receber;

-- Revoke all access from anon role
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.contas_receber FROM anon;

-- Ensure authenticated role has proper access
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_receber TO authenticated;
