-- Corrigir função RPC para usar modulo_id ao invés de modulo_codigo
DROP FUNCTION IF EXISTS get_all_user_permissions(UUID);

CREATE FUNCTION get_all_user_permissions(p_user_id UUID)
RETURNS TABLE(
  modules TEXT[],
  screens TEXT[],
  role TEXT,
  is_admin BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_is_admin BOOLEAN;
  v_department_id UUID;
  v_modules TEXT[];
  v_screens TEXT[];
BEGIN
  SELECT ur.role INTO v_role FROM user_roles ur WHERE ur.user_id = p_user_id LIMIT 1;
  
  IF v_role IS NULL THEN
    RETURN QUERY SELECT ARRAY[]::TEXT[], ARRAY[]::TEXT[], NULL::TEXT, FALSE;
    RETURN;
  END IF;
  
  v_is_admin := (v_role = 'admin');
  
  IF v_is_admin THEN
    SELECT ARRAY_AGG(DISTINCT codigo) INTO v_modules FROM modulos_sistema WHERE ativo = true;
    SELECT ARRAY_AGG(DISTINCT codigo) INTO v_screens FROM telas_sistema WHERE ativo = true;
    RETURN QUERY SELECT COALESCE(v_modules, ARRAY[]::TEXT[]), COALESCE(v_screens, ARRAY[]::TEXT[]), v_role, TRUE;
    RETURN;
  END IF;
  
  SELECT p.departamento_id INTO v_department_id FROM profiles p WHERE p.id = p_user_id;
  
  IF v_department_id IS NOT NULL THEN
    -- COM departamento: APENAS permissões do departamento + individuais (IGNORA role!)
    SELECT ARRAY_AGG(DISTINCT ms.codigo) INTO v_modules FROM (
      SELECT m.codigo FROM departamento_permissoes_modulos dpm
      JOIN modulos_sistema m ON m.id = dpm.modulo_id
      WHERE dpm.departamento_id = v_department_id AND m.ativo = true
      UNION
      SELECT upm.modulo_codigo AS codigo FROM usuario_permissoes_modulos upm WHERE upm.user_id = p_user_id
    ) ms;
    
    SELECT ARRAY_AGG(DISTINCT ts.codigo) INTO v_screens FROM (
      SELECT t.codigo FROM departamento_permissoes_telas dpt
      JOIN telas_sistema t ON t.id = dpt.tela_id
      WHERE dpt.departamento_id = v_department_id AND t.ativo = true
      UNION
      SELECT t.codigo FROM usuario_permissoes_telas upt
      JOIN telas_sistema t ON t.id = upt.tela_id
      WHERE upt.user_id = p_user_id AND t.ativo = true
    ) ts;
  ELSE
    -- SEM departamento: permissões do ROLE + individuais
    SELECT ARRAY_AGG(DISTINCT ms.codigo) INTO v_modules FROM (
      SELECT rpm.modulo_codigo AS codigo FROM role_permissoes_modulos rpm WHERE rpm.role = v_role
      UNION
      SELECT upm.modulo_codigo AS codigo FROM usuario_permissoes_modulos upm WHERE upm.user_id = p_user_id
    ) ms;
    
    SELECT ARRAY_AGG(DISTINCT ts.codigo) INTO v_screens FROM (
      SELECT t.codigo FROM role_permissoes_telas rpt
      JOIN telas_sistema t ON t.id = rpt.tela_id
      WHERE rpt.role = v_role AND t.ativo = true
      UNION
      SELECT t.codigo FROM usuario_permissoes_telas upt
      JOIN telas_sistema t ON t.id = upt.tela_id
      WHERE upt.user_id = p_user_id AND t.ativo = true
    ) ts;
  END IF;
  
  RETURN QUERY SELECT COALESCE(v_modules, ARRAY[]::TEXT[]), COALESCE(v_screens, ARRAY[]::TEXT[]), v_role, FALSE;
END;
$$;