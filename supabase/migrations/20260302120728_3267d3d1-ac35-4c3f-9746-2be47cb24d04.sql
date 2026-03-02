
-- Corrigir search_path das funções de permissões (mantendo varchar)
CREATE OR REPLACE FUNCTION public.get_user_module_permissions(_user_id uuid)
RETURNS TABLE(modulo_codigo character varying)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ms.codigo
  FROM modulos_sistema ms
  WHERE ms.ativo = true
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = _user_id AND role = 'admin'
    )
  UNION
  SELECT ms.codigo
  FROM usuario_permissoes_modulos upm
  JOIN modulos_sistema ms ON upm.modulo_id = ms.id
  WHERE upm.usuario_id = _user_id
    AND ms.ativo = true
  UNION
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

CREATE OR REPLACE FUNCTION public.get_user_screen_permissions(_user_id uuid)
RETURNS TABLE(tela_codigo character varying)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ts.codigo
  FROM telas_sistema ts
  WHERE ts.ativo = true
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = _user_id AND role = 'admin'
    )
  UNION
  SELECT ts.codigo
  FROM usuario_permissoes_telas upt
  JOIN telas_sistema ts ON upt.tela_id = ts.id
  WHERE upt.usuario_id = _user_id
    AND ts.ativo = true
  UNION
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
