
-- =============================================
-- FIX: contas_receber policies using 'public' role instead of 'authenticated'
-- This is a security gap: INSERT and UPDATE policies apply to anon users
-- =============================================

-- Drop insecure policies
DROP POLICY IF EXISTS "cr_insert_strict" ON public.contas_receber;
DROP POLICY IF EXISTS "cr_select_strict" ON public.contas_receber;
DROP POLICY IF EXISTS "cr_update_strict" ON public.contas_receber;

-- Recreate with 'authenticated' role only
CREATE POLICY "cr_insert_strict" ON public.contas_receber
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "cr_select_strict" ON public.contas_receber
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR check_user_access(auth.uid(), 'financeiro'::text)
);

CREATE POLICY "cr_update_strict" ON public.contas_receber
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR check_user_access(auth.uid(), 'financeiro'::text)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR check_user_access(auth.uid(), 'financeiro'::text)
);

-- =============================================
-- ADD: Explicit DELETE denial for profiles (defense in depth)
-- =============================================
DROP POLICY IF EXISTS "profiles_delete_denied" ON public.profiles;
CREATE POLICY "profiles_delete_denied" ON public.profiles
FOR DELETE TO authenticated
USING (false);

-- =============================================
-- ADD: Explicit anon denial for contas_pagar INSERT/UPDATE/DELETE
-- (defense in depth - currently only SELECT is denied for anon)
-- =============================================
DROP POLICY IF EXISTS "cp_deny_anon_write" ON public.contas_pagar;
CREATE POLICY "cp_deny_anon_write" ON public.contas_pagar
FOR ALL TO anon
USING (false)
WITH CHECK (false);

-- Drop the old partial anon denial since the new ALL policy covers it
DROP POLICY IF EXISTS "cp_deny_anon" ON public.contas_pagar;
