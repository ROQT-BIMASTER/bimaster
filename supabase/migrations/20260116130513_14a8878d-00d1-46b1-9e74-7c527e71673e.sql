
-- =====================================================
-- CRIAR FUNÇÕES SECURITY DEFINER PARA VERIFICAR ACESSO
-- =====================================================

-- Função para verificar se usuário tem acesso a um módulo específico
CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_modulo(_user_id uuid, _modulo_codigo text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_department_id UUID;
  v_has_access BOOLEAN;
BEGIN
  -- Se admin, tem acesso a tudo
  IF public.has_role(_user_id, 'admin') THEN
    RETURN TRUE;
  END IF;
  
  -- Buscar departamento do usuário
  SELECT p.departamento_id INTO v_department_id FROM profiles p WHERE p.id = _user_id;
  
  -- Verificar permissão individual do usuário
  SELECT EXISTS (
    SELECT 1 
    FROM usuario_permissoes_modulos upm
    JOIN modulos_sistema m ON m.id = upm.modulo_id
    WHERE upm.usuario_id = _user_id 
      AND m.codigo = _modulo_codigo 
      AND m.ativo = true
  ) INTO v_has_access;
  
  IF v_has_access THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar permissão do departamento
  IF v_department_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 
      FROM departamento_permissoes_modulos dpm
      JOIN modulos_sistema m ON m.id = dpm.modulo_id
      WHERE dpm.departamento_id = v_department_id 
        AND m.codigo = _modulo_codigo 
        AND m.ativo = true
    ) INTO v_has_access;
    
    IF v_has_access THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  -- Verificar permissão do role
  SELECT ur.role INTO v_role FROM user_roles ur WHERE ur.user_id = _user_id LIMIT 1;
  
  IF v_role IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 
      FROM role_permissoes_modulos rpm
      JOIN modulos_sistema m ON m.id = rpm.modulo_id
      WHERE rpm.role = v_role 
        AND m.codigo = _modulo_codigo 
        AND m.ativo = true
    ) INTO v_has_access;
    
    RETURN v_has_access;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Função para verificar se usuário tem acesso a uma tela específica
CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_tela(_user_id uuid, _tela_codigo text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_department_id UUID;
  v_has_access BOOLEAN;
BEGIN
  -- Se admin, tem acesso a tudo
  IF public.has_role(_user_id, 'admin') THEN
    RETURN TRUE;
  END IF;
  
  -- Buscar departamento do usuário
  SELECT p.departamento_id INTO v_department_id FROM profiles p WHERE p.id = _user_id;
  
  -- Verificar permissão individual do usuário
  SELECT EXISTS (
    SELECT 1 
    FROM usuario_permissoes_telas upt
    JOIN telas_sistema t ON t.id = upt.tela_id
    WHERE upt.usuario_id = _user_id 
      AND t.codigo = _tela_codigo 
      AND t.ativo = true
  ) INTO v_has_access;
  
  IF v_has_access THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar permissão do departamento
  IF v_department_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 
      FROM departamento_permissoes_telas dpt
      JOIN telas_sistema t ON t.id = dpt.tela_id
      WHERE dpt.departamento_id = v_department_id 
        AND t.codigo = _tela_codigo 
        AND t.ativo = true
    ) INTO v_has_access;
    
    IF v_has_access THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  -- Verificar permissão do role
  SELECT ur.role INTO v_role FROM user_roles ur WHERE ur.user_id = _user_id LIMIT 1;
  
  IF v_role IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 
      FROM role_permissoes_telas rpt
      JOIN telas_sistema t ON t.id = rpt.tela_id
      WHERE rpt.role = v_role 
        AND t.codigo = _tela_codigo 
        AND t.ativo = true
    ) INTO v_has_access;
    
    RETURN v_has_access;
  END IF;
  
  RETURN FALSE;
END;
$$;
