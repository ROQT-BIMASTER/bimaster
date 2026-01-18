-- =====================================================
-- FIX SECURITY ERRORS: RLS Policies for Exposed Tables
-- =====================================================

-- 1. CONTAS_RECEBER - Restrict to authenticated users only (finance team)
-- =====================================================

-- Enable RLS if not already enabled
ALTER TABLE public.contas_receber ENABLE ROW LEVEL SECURITY;

-- Drop existing overly permissive policies if any
DROP POLICY IF EXISTS "contas_receber_public_select" ON public.contas_receber;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.contas_receber;
DROP POLICY IF EXISTS "Anyone can view contas_receber" ON public.contas_receber;

-- Create secure policies
CREATE POLICY "contas_receber_select_authenticated"
ON public.contas_receber FOR SELECT
TO authenticated
USING (
  is_admin_or_supervisor(auth.uid()) OR
  has_role(auth.uid(), 'vendedor'::app_role)
);

CREATE POLICY "contas_receber_insert_admin"
ON public.contas_receber FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "contas_receber_update_admin"
ON public.contas_receber FOR UPDATE
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "contas_receber_delete_admin"
ON public.contas_receber FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. PROFILES - Users see own profile, admins/supervisors see all
-- =====================================================

-- Enable RLS if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "profiles_public_select" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create secure policies
CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid() OR
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "profiles_update_own_or_admin"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  id = auth.uid() OR
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- 3. FABRICA_PRECOS_PRODUTOS - Restrict to admin/supervisor only
-- =====================================================

-- Enable RLS if not already enabled
ALTER TABLE public.fabrica_precos_produtos ENABLE ROW LEVEL SECURITY;

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "fabrica_precos_produtos_public_select" ON public.fabrica_precos_produtos;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.fabrica_precos_produtos;
DROP POLICY IF EXISTS "Anyone can view fabrica_precos_produtos" ON public.fabrica_precos_produtos;

-- Create secure policies - only admin and supervisor can access pricing data
CREATE POLICY "fabrica_precos_select_admin_supervisor"
ON public.fabrica_precos_produtos FOR SELECT
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "fabrica_precos_insert_admin"
ON public.fabrica_precos_produtos FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "fabrica_precos_update_admin"
ON public.fabrica_precos_produtos FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "fabrica_precos_delete_admin"
ON public.fabrica_precos_produtos FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));