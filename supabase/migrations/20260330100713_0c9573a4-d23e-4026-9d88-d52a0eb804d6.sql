
-- Drop and recreate fallback functions (return type changed)
DROP FUNCTION IF EXISTS public.get_user_combined_module_permissions(uuid);
DROP FUNCTION IF EXISTS public.get_user_combined_screen_permissions(uuid);

-- Recreate with override logic
CREATE FUNCTION public.get_user_combined_module_permissions(_user_id uuid)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Admin: tudo
  SELECT ms.codigo
  FROM public.modulos_sistema ms
  WHERE ms.ativo = true
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
  UNION
  -- Custom override: se tem registros individuais, usar APENAS esses
  SELECT ms.codigo
  FROM public.usuario_permissoes_modulos upm
  JOIN public.modulos_sistema ms ON upm.modulo_id = ms.id
  WHERE upm.usuario_id = _user_id
    AND ms.ativo = true
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
    AND EXISTS (SELECT 1 FROM public.usuario_permissoes_modulos WHERE usuario_id = _user_id)
  UNION
  -- Fallback role (somente se NÃO tem registros individuais)
  SELECT ms.codigo
  FROM public.role_permissoes_modulos rpm
  JOIN public.modulos_sistema ms ON rpm.modulo_id = ms.id
  JOIN public.user_roles ur ON rpm.role = ur.role
  WHERE ur.user_id = _user_id
    AND ms.ativo = true
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
    AND NOT EXISTS (SELECT 1 FROM public.usuario_permissoes_modulos WHERE usuario_id = _user_id)
  UNION
  -- Fallback departamento (somente se NÃO tem registros individuais)
  SELECT ms.codigo
  FROM public.departamento_permissoes_modulos dpm
  JOIN public.modulos_sistema ms ON dpm.modulo_id = ms.id
  JOIN public.profiles p ON p.departamento_id = dpm.departamento_id
  WHERE p.id = _user_id
    AND ms.ativo = true
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
    AND NOT EXISTS (SELECT 1 FROM public.usuario_permissoes_modulos WHERE usuario_id = _user_id);
$$;

CREATE FUNCTION public.get_user_combined_screen_permissions(_user_id uuid)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Admin: tudo
  SELECT ts.codigo
  FROM public.telas_sistema ts
  WHERE ts.ativo = true
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
  UNION
  -- Custom override
  SELECT ts.codigo
  FROM public.usuario_permissoes_telas upt
  JOIN public.telas_sistema ts ON upt.tela_id = ts.id
  WHERE upt.usuario_id = _user_id
    AND ts.ativo = true
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
    AND EXISTS (SELECT 1 FROM public.usuario_permissoes_telas WHERE usuario_id = _user_id)
  UNION
  -- Fallback role
  SELECT ts.codigo
  FROM public.role_permissoes_telas rpt
  JOIN public.telas_sistema ts ON rpt.tela_id = ts.id
  JOIN public.user_roles ur ON rpt.role = ur.role
  WHERE ur.user_id = _user_id
    AND ts.ativo = true
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
    AND NOT EXISTS (SELECT 1 FROM public.usuario_permissoes_telas WHERE usuario_id = _user_id)
  UNION
  -- Fallback departamento
  SELECT ts.codigo
  FROM public.departamento_permissoes_telas dpt
  JOIN public.telas_sistema ts ON dpt.tela_id = ts.id
  JOIN public.profiles p ON p.departamento_id = dpt.departamento_id
  WHERE p.id = _user_id
    AND ts.ativo = true
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
    AND NOT EXISTS (SELECT 1 FROM public.usuario_permissoes_telas WHERE usuario_id = _user_id);
$$;
