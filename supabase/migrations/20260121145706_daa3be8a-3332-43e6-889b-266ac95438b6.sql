-- =====================================================
-- CORREÇÃO DE SEGURANÇA: Políticas RLS mais restritivas
-- =====================================================

-- =====================================================
-- 1. PROFILES - Restringir visibilidade por hierarquia
-- =====================================================

-- Remover políticas permissivas existentes
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;

-- Criar função para verificar se pode ver perfil (baseado em hierarquia)
CREATE OR REPLACE FUNCTION public.can_view_profile(_viewer_id uuid, _profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _viewer_dept uuid;
  _profile_dept uuid;
  _is_admin boolean;
  _is_supervisor boolean;
BEGIN
  -- Próprio perfil sempre pode ver
  IF _viewer_id = _profile_id THEN
    RETURN true;
  END IF;
  
  -- Verificar se é admin
  SELECT EXISTS(
    SELECT 1 FROM user_roles WHERE user_id = _viewer_id AND role = 'admin'
  ) INTO _is_admin;
  
  IF _is_admin THEN
    RETURN true;
  END IF;
  
  -- Verificar se é supervisor direto ou indireto
  IF is_supervisor_of(_viewer_id, _profile_id) THEN
    RETURN true;
  END IF;
  
  -- Supervisores podem ver perfis do mesmo departamento
  SELECT EXISTS(
    SELECT 1 FROM user_roles WHERE user_id = _viewer_id AND role = 'supervisor'
  ) INTO _is_supervisor;
  
  IF _is_supervisor THEN
    SELECT departamento_id INTO _viewer_dept FROM profiles WHERE id = _viewer_id;
    SELECT departamento_id INTO _profile_dept FROM profiles WHERE id = _profile_id;
    
    -- Mesmo departamento
    IF _viewer_dept IS NOT NULL AND _viewer_dept = _profile_dept THEN
      RETURN true;
    END IF;
  END IF;
  
  RETURN false;
END;
$$;

-- Nova política: Usuários podem ver perfis baseado em hierarquia
CREATE POLICY "profiles_select_hierarchy_based" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  can_view_profile(auth.uid(), id)
);

-- Nova política: Apenas próprio perfil pode ser atualizado (admin via service_role)
CREATE POLICY "profiles_update_own_only" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- =====================================================
-- 2. CONTAS_RECEBER - Restringir a equipe financeira
-- =====================================================

-- Remover políticas permissivas existentes
DROP POLICY IF EXISTS "contas_receber_select_finance_only" ON public.contas_receber;
DROP POLICY IF EXISTS "Finance and admins can insert contas_receber" ON public.contas_receber;
DROP POLICY IF EXISTS "Finance and admins can update contas_receber" ON public.contas_receber;
DROP POLICY IF EXISTS "Finance and admins can delete contas_receber" ON public.contas_receber;

-- Criar função para verificar acesso financeiro restrito
CREATE OR REPLACE FUNCTION public.has_finance_access(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _dept_code text;
  _is_admin boolean;
BEGIN
  -- Admins têm acesso total
  SELECT EXISTS(
    SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin'
  ) INTO _is_admin;
  
  IF _is_admin THEN
    RETURN true;
  END IF;
  
  -- Verificar se está no departamento financeiro
  SELECT d.codigo INTO _dept_code
  FROM profiles p
  JOIN departamentos d ON d.id = p.departamento_id
  WHERE p.id = _user_id;
  
  -- Aceitar departamentos financeiros (códigos que contenham 'financ' ou 'cobran')
  IF _dept_code IS NOT NULL AND (
    lower(_dept_code) LIKE '%financ%' OR 
    lower(_dept_code) LIKE '%cobran%' OR
    lower(_dept_code) LIKE '%tesour%' OR
    lower(_dept_code) LIKE '%contab%'
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Nova política: SELECT apenas para equipe financeira e admins
CREATE POLICY "contas_receber_select_finance_team" 
ON public.contas_receber 
FOR SELECT 
TO authenticated
USING (
  has_finance_access(auth.uid())
);

-- Nova política: INSERT apenas para equipe financeira
CREATE POLICY "contas_receber_insert_finance_team" 
ON public.contas_receber 
FOR INSERT 
TO authenticated
WITH CHECK (
  has_finance_access(auth.uid())
);

-- Nova política: UPDATE apenas para equipe financeira
CREATE POLICY "contas_receber_update_finance_team" 
ON public.contas_receber 
FOR UPDATE 
TO authenticated
USING (
  has_finance_access(auth.uid())
);

-- Nova política: DELETE apenas para admins
CREATE POLICY "contas_receber_delete_admin_only" 
ON public.contas_receber 
FOR DELETE 
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
);

-- Remover política duplicada de delete
DROP POLICY IF EXISTS "contas_receber_delete_admin" ON public.contas_receber;

-- =====================================================
-- 3. Limpar políticas duplicadas de insert
-- =====================================================
DROP POLICY IF EXISTS "contas_receber_insert_admin" ON public.contas_receber;
DROP POLICY IF EXISTS "contas_receber_update_admin" ON public.contas_receber;

-- Comentários de documentação
COMMENT ON FUNCTION public.can_view_profile IS 'Verifica se um usuário pode visualizar o perfil de outro baseado em hierarquia organizacional';
COMMENT ON FUNCTION public.has_finance_access IS 'Verifica se usuário tem acesso a dados financeiros (admin ou departamento financeiro)';