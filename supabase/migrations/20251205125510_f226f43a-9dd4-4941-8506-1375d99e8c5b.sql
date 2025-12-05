-- Add RLS policies to protect sensitive tables

-- =====================================================
-- 1. PROFILES TABLE - Employee personal data
-- =====================================================
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile, admin/supervisor can view all
CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid() 
  OR public.is_admin_or_supervisor(auth.uid())
  OR public.is_supervisor_of(auth.uid(), id)
);

-- Users can update only their own profile
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Only admin can insert profiles (normally done via trigger)
CREATE POLICY "profiles_insert_admin"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR id = auth.uid());

-- =====================================================
-- 2. CONTAS_PAGAR TABLE - Financial records
-- =====================================================
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.contas_pagar;
DROP POLICY IF EXISTS "contas_pagar_select_policy" ON public.contas_pagar;

ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;

-- Only admin/supervisor can access financial records
CREATE POLICY "contas_pagar_select_admin_supervisor"
ON public.contas_pagar
FOR SELECT
TO authenticated
USING (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "contas_pagar_insert_admin"
ON public.contas_pagar
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "contas_pagar_update_admin"
ON public.contas_pagar
FOR UPDATE
TO authenticated
USING (public.is_admin_or_supervisor(auth.uid()))
WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "contas_pagar_delete_admin"
ON public.contas_pagar
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- 3. PROSPECTS TABLE - Sales prospects
-- =====================================================
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.prospects;
DROP POLICY IF EXISTS "prospects_select_policy" ON public.prospects;
DROP POLICY IF EXISTS "prospects_select_restricted" ON public.prospects;

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

-- Users can see prospects they own, are assigned to, or admin/supervisor
CREATE POLICY "prospects_select_owner_assigned_admin"
ON public.prospects
FOR SELECT
TO authenticated
USING (
  vendedor_id = auth.uid()
  OR public.is_admin_or_supervisor(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.usuario_prospects up 
    WHERE up.prospect_id = prospects.id AND up.usuario_id = auth.uid()
  )
);

CREATE POLICY "prospects_insert_authenticated"
ON public.prospects
FOR INSERT
TO authenticated
WITH CHECK (
  vendedor_id = auth.uid() 
  OR public.is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "prospects_update_owner_admin"
ON public.prospects
FOR UPDATE
TO authenticated
USING (
  vendedor_id = auth.uid() 
  OR public.is_admin_or_supervisor(auth.uid())
)
WITH CHECK (
  vendedor_id = auth.uid() 
  OR public.is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "prospects_delete_admin"
ON public.prospects
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- 4. STORES TABLE - Store network data
-- =====================================================
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.stores;
DROP POLICY IF EXISTS "stores_select_policy" ON public.stores;

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Users can see stores assigned to them, or admin/supervisor can see all
CREATE POLICY "stores_select_assigned_admin"
ON public.stores
FOR SELECT
TO authenticated
USING (
  vendedor_id = auth.uid()
  OR supervisor_id = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "stores_insert_authenticated"
ON public.stores
FOR INSERT
TO authenticated
WITH CHECK (
  vendedor_id = auth.uid() 
  OR public.is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "stores_update_owner_admin"
ON public.stores
FOR UPDATE
TO authenticated
USING (
  vendedor_id = auth.uid() 
  OR supervisor_id = auth.uid()
  OR public.is_admin_or_supervisor(auth.uid())
)
WITH CHECK (
  vendedor_id = auth.uid() 
  OR supervisor_id = auth.uid()
  OR public.is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "stores_delete_admin"
ON public.stores
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));