-- ============================================
-- CORREÇÃO: Departamento prevalece sobre Role
-- ============================================

-- Fase 1: Corrigir função principal get_all_user_permissions
DROP FUNCTION IF EXISTS get_all_user_permissions(uuid);

CREATE OR REPLACE FUNCTION get_all_user_permissions(p_user_id uuid)
RETURNS TABLE(modules text[], screens text[], role text, is_admin boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_role TEXT;
  v_is_admin BOOLEAN;
  v_department_id UUID;
  v_modules TEXT[];
  v_screens TEXT[];
BEGIN
  -- Buscar role
  SELECT ur.role INTO v_role FROM user_roles ur WHERE ur.user_id = p_user_id LIMIT 1;
  
  IF v_role IS NULL THEN
    RETURN QUERY SELECT ARRAY[]::TEXT[], ARRAY[]::TEXT[], NULL::TEXT, FALSE;
    RETURN;
  END IF;
  
  v_is_admin := (v_role = 'admin');
  
  -- Admin: tudo
  IF v_is_admin THEN
    SELECT ARRAY_AGG(DISTINCT codigo) INTO v_modules FROM modulos_sistema WHERE ativo = true;
    SELECT ARRAY_AGG(DISTINCT codigo) INTO v_screens FROM telas_sistema WHERE ativo = true;
    RETURN QUERY SELECT COALESCE(v_modules, ARRAY[]::TEXT[]), COALESCE(v_screens, ARRAY[]::TEXT[]), v_role, TRUE;
    RETURN;
  END IF;
  
  -- Buscar departamento do usuário
  SELECT p.departamento_id INTO v_department_id FROM profiles p WHERE p.id = p_user_id;
  
  IF v_department_id IS NOT NULL THEN
    -- *** COM DEPARTAMENTO: APENAS permissões do departamento + individuais ***
    -- IGNORA completamente as permissões do role!
    
    SELECT ARRAY_AGG(DISTINCT ms.codigo) INTO v_modules FROM (
      -- Módulos do departamento
      SELECT m.codigo FROM departamento_permissoes_modulos dpm
      JOIN modulos_sistema m ON m.id = dpm.modulo_id
      WHERE dpm.departamento_id = v_department_id AND m.ativo = true
      UNION
      -- Módulos individuais do usuário
      SELECT m.codigo FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema m ON m.id = upm.modulo_id
      WHERE upm.usuario_id = p_user_id AND m.ativo = true
    ) ms;
    
    SELECT ARRAY_AGG(DISTINCT ts.codigo) INTO v_screens FROM (
      -- Telas do departamento
      SELECT t.codigo FROM departamento_permissoes_telas dpt
      JOIN telas_sistema t ON t.id = dpt.tela_id
      WHERE dpt.departamento_id = v_department_id AND t.ativo = true
      UNION
      -- Telas individuais do usuário
      SELECT t.codigo FROM usuario_permissoes_telas upt
      JOIN telas_sistema t ON t.id = upt.tela_id
      WHERE upt.usuario_id = p_user_id AND t.ativo = true
    ) ts;
  ELSE
    -- *** SEM DEPARTAMENTO: permissões do ROLE + individuais ***
    
    SELECT ARRAY_AGG(DISTINCT ms.codigo) INTO v_modules FROM (
      SELECT m.codigo FROM role_permissoes_modulos rpm
      JOIN modulos_sistema m ON m.id = rpm.modulo_id
      WHERE rpm.role = v_role AND m.ativo = true
      UNION
      SELECT m.codigo FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema m ON m.id = upm.modulo_id
      WHERE upm.usuario_id = p_user_id AND m.ativo = true
    ) ms;
    
    SELECT ARRAY_AGG(DISTINCT ts.codigo) INTO v_screens FROM (
      SELECT t.codigo FROM role_permissoes_telas rpt
      JOIN telas_sistema t ON t.id = rpt.tela_id
      WHERE rpt.role = v_role AND t.ativo = true
      UNION
      SELECT t.codigo FROM usuario_permissoes_telas upt
      JOIN telas_sistema t ON t.id = upt.tela_id
      WHERE upt.usuario_id = p_user_id AND t.ativo = true
    ) ts;
  END IF;
  
  RETURN QUERY SELECT COALESCE(v_modules, ARRAY[]::TEXT[]), COALESCE(v_screens, ARRAY[]::TEXT[]), v_role, FALSE;
END;
$$;

-- Fase 2: Corrigir função de fallback get_user_combined_module_permissions
DROP FUNCTION IF EXISTS get_user_combined_module_permissions(uuid);

CREATE OR REPLACE FUNCTION get_user_combined_module_permissions(_user_id uuid)
RETURNS TABLE(modulo_codigo varchar)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- Admin: todos os módulos ativos
  SELECT ms.codigo
  FROM modulos_sistema ms
  WHERE ms.ativo = true
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin')
  
  UNION
  
  -- COM departamento: apenas departamento (ignora role completamente)
  SELECT ms.codigo
  FROM departamento_permissoes_modulos dpm
  JOIN modulos_sistema ms ON dpm.modulo_id = ms.id
  JOIN profiles p ON p.departamento_id = dpm.departamento_id
  WHERE p.id = _user_id
    AND ms.ativo = true
    AND NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin')
  
  UNION
  
  -- SEM departamento: permissões do role
  SELECT ms.codigo
  FROM role_permissoes_modulos rpm
  JOIN modulos_sistema ms ON rpm.modulo_id = ms.id
  JOIN user_roles ur ON rpm.role = ur.role
  WHERE ur.user_id = _user_id
    AND ms.ativo = true
    AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = _user_id AND departamento_id IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin')
  
  UNION
  
  -- Permissões individuais (sempre aplicadas)
  SELECT ms.codigo
  FROM usuario_permissoes_modulos upm
  JOIN modulos_sistema ms ON upm.modulo_id = ms.id
  WHERE upm.usuario_id = _user_id
    AND ms.ativo = true;
$$;

-- Fase 3: Corrigir função de fallback get_user_combined_screen_permissions
DROP FUNCTION IF EXISTS get_user_combined_screen_permissions(uuid);

CREATE OR REPLACE FUNCTION get_user_combined_screen_permissions(_user_id uuid)
RETURNS TABLE(tela_codigo varchar)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- Admin: todas as telas ativas
  SELECT ts.codigo
  FROM telas_sistema ts
  WHERE ts.ativo = true
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin')
  
  UNION
  
  -- COM departamento: apenas telas do departamento (ignora role)
  SELECT ts.codigo
  FROM departamento_permissoes_telas dpt
  JOIN telas_sistema ts ON dpt.tela_id = ts.id
  JOIN profiles p ON p.departamento_id = dpt.departamento_id
  WHERE p.id = _user_id
    AND ts.ativo = true
    AND NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin')
  
  UNION
  
  -- SEM departamento: telas do role
  SELECT ts.codigo
  FROM role_permissoes_telas rpt
  JOIN telas_sistema ts ON rpt.tela_id = ts.id
  JOIN user_roles ur ON rpt.role = ur.role
  WHERE ur.user_id = _user_id
    AND ts.ativo = true
    AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = _user_id AND departamento_id IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin')
  
  UNION
  
  -- Permissões individuais (sempre aplicadas)
  SELECT ts.codigo
  FROM usuario_permissoes_telas upt
  JOIN telas_sistema ts ON upt.tela_id = ts.id
  WHERE upt.usuario_id = _user_id
    AND ts.ativo = true;
$$;