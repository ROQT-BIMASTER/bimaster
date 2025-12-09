-- Criar função get_user_combined_module_permissions para fallback no PermissionsContext
CREATE OR REPLACE FUNCTION public.get_user_combined_module_permissions(_user_id uuid)
RETURNS TABLE(modulo_codigo varchar)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Admin tem acesso a todos os módulos
  SELECT ms.codigo
  FROM modulos_sistema ms
  WHERE ms.ativo = true
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = _user_id AND role = 'admin'
    )
  
  UNION
  
  -- Permissões por role
  SELECT ms.codigo
  FROM role_permissoes_modulos rpm
  JOIN modulos_sistema ms ON rpm.modulo_id = ms.id
  JOIN user_roles ur ON rpm.role = ur.role
  WHERE ur.user_id = _user_id
    AND ms.ativo = true
    
  UNION
  
  -- Permissões individuais do usuário
  SELECT ms.codigo
  FROM usuario_permissoes_modulos upm
  JOIN modulos_sistema ms ON upm.modulo_id = ms.id
  WHERE upm.usuario_id = _user_id
    AND ms.ativo = true
    
  UNION
  
  -- Permissões por departamento
  SELECT ms.codigo
  FROM departamento_permissoes_modulos dpm
  JOIN modulos_sistema ms ON dpm.modulo_id = ms.id
  JOIN profiles p ON p.departamento_id = dpm.departamento_id
  WHERE p.id = _user_id
    AND ms.ativo = true;
$$;

-- Criar função get_user_combined_screen_permissions para fallback
CREATE OR REPLACE FUNCTION public.get_user_combined_screen_permissions(_user_id uuid)
RETURNS TABLE(tela_codigo varchar)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Admin tem acesso a todas as telas
  SELECT ts.codigo
  FROM telas_sistema ts
  WHERE ts.ativo = true
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = _user_id AND role = 'admin'
    )
  
  UNION
  
  -- Permissões por role
  SELECT ts.codigo
  FROM role_permissoes_telas rpt
  JOIN telas_sistema ts ON rpt.tela_id = ts.id
  JOIN user_roles ur ON rpt.role = ur.role
  WHERE ur.user_id = _user_id
    AND ts.ativo = true
    
  UNION
  
  -- Permissões individuais do usuário
  SELECT ts.codigo
  FROM usuario_permissoes_telas upt
  JOIN telas_sistema ts ON upt.tela_id = ts.id
  WHERE upt.usuario_id = _user_id
    AND ts.ativo = true
    
  UNION
  
  -- Permissões por departamento
  SELECT ts.codigo
  FROM departamento_permissoes_telas dpt
  JOIN telas_sistema ts ON dpt.tela_id = ts.id
  JOIN profiles p ON p.departamento_id = dpt.departamento_id
  WHERE p.id = _user_id
    AND ts.ativo = true;
$$;