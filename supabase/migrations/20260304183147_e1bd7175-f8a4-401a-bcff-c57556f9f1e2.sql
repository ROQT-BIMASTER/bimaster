
-- =====================================================
-- SECURITY HARDENING: Financial access + Profile access
-- =====================================================

-- 1. Create strict financial access function (no supervisor/gerente bypass)
CREATE OR REPLACE FUNCTION public.can_access_financeiro_strict(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _role text;
  _department_id uuid;
BEGIN
  -- Get role and department
  SELECT ur.role::text, p.departamento_id
  INTO _role, _department_id
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.user_id = _user_id
  LIMIT 1;

  -- Admin always has access
  IF _role = 'admin' THEN RETURN true; END IF;

  -- Check explicit user permission for 'financeiro' module
  IF EXISTS (
    SELECT 1 FROM public.usuario_permissoes_modulos upm
    JOIN public.modulos_sistema ms ON ms.id = upm.modulo_id
    WHERE upm.usuario_id = _user_id AND ms.codigo = 'financeiro' AND ms.ativo = true
  ) THEN RETURN true; END IF;

  -- Check department-level permission for 'financeiro' module
  IF _department_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.departamento_permissoes_modulos dpm
    JOIN public.modulos_sistema ms ON ms.id = dpm.modulo_id
    WHERE dpm.departamento_id = _department_id AND ms.codigo = 'financeiro' AND ms.ativo = true
  ) THEN RETURN true; END IF;

  -- Check role-level permission for 'financeiro' module
  IF _role IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.role_permissoes_modulos rpm
    JOIN public.modulos_sistema ms ON ms.id = rpm.modulo_id
    WHERE rpm.role = _role AND ms.codigo = 'financeiro' AND ms.ativo = true
  ) THEN RETURN true; END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.can_access_financeiro_strict IS 
'Strict financial access check - NO automatic supervisor/gerente bypass. Only admin or explicit financeiro module permission.';

-- 2. Update contas_receber policies
DROP POLICY IF EXISTS "cr_select_strict" ON public.contas_receber;
CREATE POLICY "cr_select_strict" ON public.contas_receber
  FOR SELECT TO authenticated
  USING (public.can_access_financeiro_strict(auth.uid()));

DROP POLICY IF EXISTS "cr_update_strict" ON public.contas_receber;
CREATE POLICY "cr_update_strict" ON public.contas_receber
  FOR UPDATE TO authenticated
  USING (public.can_access_financeiro_strict(auth.uid()))
  WITH CHECK (public.can_access_financeiro_strict(auth.uid()));

-- 3. Update contas_pagar policies
DROP POLICY IF EXISTS "cp_select" ON public.contas_pagar;
CREATE POLICY "cp_select" ON public.contas_pagar
  FOR SELECT TO authenticated
  USING (public.can_access_financeiro_strict(auth.uid()));

DROP POLICY IF EXISTS "cp_update" ON public.contas_pagar;
CREATE POLICY "cp_update" ON public.contas_pagar
  FOR UPDATE TO authenticated
  USING (public.can_access_financeiro_strict(auth.uid()));

DROP POLICY IF EXISTS "cp_insert" ON public.contas_pagar;
CREATE POLICY "cp_insert" ON public.contas_pagar
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_financeiro_strict(auth.uid()));

-- 4. Fix can_view_profile: gerentes see only direct subordinates
CREATE OR REPLACE FUNCTION public.can_view_profile(viewer_id uuid, target_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  viewer_role public.app_role;
  is_direct_subordinate boolean;
BEGIN
  -- Users can always see their own profile
  IF viewer_id = target_profile_id THEN
    RETURN true;
  END IF;
  
  -- Get the viewer's role
  SELECT role INTO viewer_role
  FROM public.user_roles
  WHERE user_id = viewer_id
  LIMIT 1;
  
  -- Admins can see all profiles
  IF viewer_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Gerentes can only see their DIRECT subordinates (via gerente_id)
  IF viewer_role = 'gerente' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.profiles
      WHERE id = target_profile_id
      AND gerente_id = viewer_id
    ) INTO is_direct_subordinate;
    
    RETURN is_direct_subordinate;
  END IF;
  
  -- Supervisors can only see their DIRECT subordinates (via supervisor_id)
  IF viewer_role = 'supervisor' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.profiles
      WHERE id = target_profile_id
      AND supervisor_id = viewer_id
    ) INTO is_direct_subordinate;
    
    RETURN is_direct_subordinate;
  END IF;
  
  -- All other users can only see their own profile
  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.can_view_profile IS 
'Profile visibility: admins see all, gerentes see subordinates via gerente_id, supervisors via supervisor_id, others only self.';
