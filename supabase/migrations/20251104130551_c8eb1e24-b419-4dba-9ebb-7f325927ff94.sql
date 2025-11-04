-- Função otimizada para buscar permissões de módulos em bulk
CREATE OR REPLACE FUNCTION public.get_user_module_permissions(_user_id uuid)
RETURNS TABLE(modulo_codigo varchar(50))
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
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
  
  -- Permissões específicas do usuário (override)
  SELECT ms.codigo
  FROM usuario_permissoes_modulos upm
  JOIN modulos_sistema ms ON upm.modulo_id = ms.id
  WHERE upm.usuario_id = _user_id
    AND ms.ativo = true
  
  UNION
  
  -- Permissões por role (se não for admin e não tiver override)
  SELECT ms.codigo
  FROM role_permissoes_modulos rpm
  JOIN modulos_sistema ms ON rpm.modulo_id = ms.id
  JOIN user_roles ur ON rpm.role = ur.role
  WHERE ur.user_id = _user_id
    AND ms.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = _user_id AND role = 'admin'
    );
$$;

-- Função otimizada para buscar permissões de telas em bulk
CREATE OR REPLACE FUNCTION public.get_user_screen_permissions(_user_id uuid)
RETURNS TABLE(tela_codigo varchar(50))
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
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
  
  -- Permissões específicas do usuário (override)
  SELECT ts.codigo
  FROM usuario_permissoes_telas upt
  JOIN telas_sistema ts ON upt.tela_id = ts.id
  WHERE upt.usuario_id = _user_id
    AND ts.ativo = true
  
  UNION
  
  -- Permissões por role (se não for admin e não tiver override)
  SELECT ts.codigo
  FROM role_permissoes_telas rpt
  JOIN telas_sistema ts ON rpt.tela_id = ts.id
  JOIN user_roles ur ON rpt.role = ur.role
  WHERE ur.user_id = _user_id
    AND ts.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = _user_id AND role = 'admin'
    );
$$;

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_usuario_permissoes_telas_usuario_id ON usuario_permissoes_telas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_permissoes_modulos_usuario_id ON usuario_permissoes_modulos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_role_permissoes_telas_role ON role_permissoes_telas(role);
CREATE INDEX IF NOT EXISTS idx_role_permissoes_modulos_role ON role_permissoes_modulos(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_telas_sistema_ativo ON telas_sistema(ativo) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_modulos_sistema_ativo ON modulos_sistema(ativo) WHERE ativo = true;