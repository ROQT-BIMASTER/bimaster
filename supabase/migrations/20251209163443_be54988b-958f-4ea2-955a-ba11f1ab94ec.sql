-- Drop existing policies on profiles table
DROP POLICY IF EXISTS "Admins e supervisores podem atualizar perfis" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem ver próprio perfil ou admins/supervisores veem" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- Create more restrictive SELECT policy
-- Users can only see:
-- 1. Their own profile
-- 2. Profiles of users they directly supervise (via supervisor_id)
-- 3. Admins can see all (required for user management)
CREATE POLICY "profiles_select_restricted" ON public.profiles
FOR SELECT USING (
  id = auth.uid() -- Own profile
  OR supervisor_id = auth.uid() -- Direct subordinates
  OR has_role(auth.uid(), 'admin'::app_role) -- Admins only (not supervisors)
);

-- INSERT: Only admins can create profiles, or user creating their own during signup
CREATE POLICY "profiles_insert_restricted" ON public.profiles
FOR INSERT WITH CHECK (
  id = auth.uid() -- Own profile during signup
  OR has_role(auth.uid(), 'admin'::app_role) -- Admins can create
);

-- UPDATE: Users can update own profile, admins can update any
CREATE POLICY "profiles_update_restricted" ON public.profiles
FOR UPDATE USING (
  id = auth.uid() -- Own profile
  OR has_role(auth.uid(), 'admin'::app_role) -- Admins only
)
WITH CHECK (
  id = auth.uid() -- Own profile
  OR has_role(auth.uid(), 'admin'::app_role) -- Admins only
);

-- DELETE: Only admins can delete profiles
CREATE POLICY "profiles_delete_admin_only" ON public.profiles
FOR DELETE USING (
  has_role(auth.uid(), 'admin'::app_role)
);