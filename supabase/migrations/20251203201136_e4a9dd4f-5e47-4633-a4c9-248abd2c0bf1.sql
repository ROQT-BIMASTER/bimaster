-- Função otimizada para buscar todas as permissões do usuário em uma única chamada
CREATE OR REPLACE FUNCTION get_all_user_permissions(_user_id uuid)
RETURNS TABLE (
  user_role text,
  module_codes text[],
  screen_codes text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_is_admin boolean;
  v_modules text[];
  v_screens text[];
BEGIN
  -- Buscar role do usuário
  SELECT role::text INTO v_role
  FROM user_roles
  WHERE user_id = _user_id
  LIMIT 1;
  
  v_role := COALESCE(v_role, 'vendedor');
  v_is_admin := v_role = 'admin';
  
  -- Se admin, retorna todos os módulos e telas
  IF v_is_admin THEN
    SELECT ARRAY_AGG(codigo) INTO v_modules
    FROM modulos_sistema WHERE ativo = true;
    
    SELECT ARRAY_AGG(codigo) INTO v_screens
    FROM telas_sistema WHERE ativo = true;
  ELSE
    -- Módulos: combina role + departamento + individual
    SELECT ARRAY_AGG(DISTINCT codigo) INTO v_modules
    FROM (
      -- Por role
      SELECT ms.codigo
      FROM role_permissoes_modulos rpm
      JOIN modulos_sistema ms ON rpm.modulo_id = ms.id
      WHERE rpm.role::text = v_role AND ms.ativo = true
      
      UNION
      
      -- Por departamento
      SELECT ms.codigo
      FROM departamento_permissoes_modulos dpm
      JOIN modulos_sistema ms ON dpm.modulo_id = ms.id
      JOIN profiles p ON p.departamento_id = dpm.departamento_id
      WHERE p.id = _user_id AND ms.ativo = true
      
      UNION
      
      -- Individual
      SELECT ms.codigo
      FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON upm.modulo_id = ms.id
      WHERE upm.usuario_id = _user_id AND ms.ativo = true
    ) combined_modules;
    
    -- Telas: combina role + departamento + individual
    SELECT ARRAY_AGG(DISTINCT codigo) INTO v_screens
    FROM (
      -- Por role
      SELECT ts.codigo
      FROM role_permissoes_telas rpt
      JOIN telas_sistema ts ON rpt.tela_id = ts.id
      WHERE rpt.role::text = v_role AND ts.ativo = true
      
      UNION
      
      -- Por departamento
      SELECT ts.codigo
      FROM departamento_permissoes_telas dpt
      JOIN telas_sistema ts ON dpt.tela_id = ts.id
      JOIN profiles p ON p.departamento_id = dpt.departamento_id
      WHERE p.id = _user_id AND ts.ativo = true
      
      UNION
      
      -- Individual
      SELECT ts.codigo
      FROM usuario_permissoes_telas upt
      JOIN telas_sistema ts ON upt.tela_id = ts.id
      WHERE upt.usuario_id = _user_id AND ts.ativo = true
    ) combined_screens;
  END IF;
  
  RETURN QUERY SELECT v_role, COALESCE(v_modules, ARRAY[]::text[]), COALESCE(v_screens, ARRAY[]::text[]);
END;
$$;