
-- Corrigir get_all_user_permissions com search_path = public
CREATE OR REPLACE FUNCTION public.get_all_user_permissions(p_user_id uuid)
RETURNS TABLE(role text, is_admin boolean, modules text[], screens text[])
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
  v_departamento_id uuid;
BEGIN
  SELECT ur.role::text INTO v_role
  FROM public.user_roles ur
  WHERE ur.user_id = p_user_id
  LIMIT 1;

  v_role := COALESCE(v_role, 'vendedor');
  v_is_admin := (v_role = 'admin');

  IF v_is_admin THEN
    SELECT array_agg(DISTINCT m.codigo)
    INTO v_modules
    FROM public.modulos_sistema m
    WHERE m.ativo = true;

    SELECT array_agg(DISTINCT t.codigo)
    INTO v_screens
    FROM public.telas_sistema t
    WHERE t.ativo = true;

    RETURN QUERY SELECT v_role, v_is_admin, COALESCE(v_modules, ARRAY[]::text[]), COALESCE(v_screens, ARRAY[]::text[]);
    RETURN;
  END IF;

  SELECT p.departamento_id INTO v_departamento_id
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_departamento_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT m.codigo)
    INTO v_modules
    FROM public.modulos_sistema m
    WHERE m.ativo = true
    AND (
      EXISTS (
        SELECT 1 FROM public.departamento_permissoes_modulos dpm
        WHERE dpm.departamento_id = v_departamento_id AND dpm.modulo_id = m.id
      )
      OR EXISTS (
        SELECT 1 FROM public.role_permissoes_modulos rpm
        WHERE rpm.role = v_role::public.app_role AND rpm.modulo_id = m.id
      )
      OR EXISTS (
        SELECT 1 FROM public.usuario_permissoes_modulos upm
        WHERE upm.usuario_id = p_user_id AND upm.modulo_id = m.id
      )
    );
  ELSE
    SELECT array_agg(DISTINCT m.codigo)
    INTO v_modules
    FROM public.modulos_sistema m
    WHERE m.ativo = true
    AND (
      EXISTS (
        SELECT 1 FROM public.role_permissoes_modulos rpm
        WHERE rpm.role = v_role::public.app_role AND rpm.modulo_id = m.id
      )
      OR EXISTS (
        SELECT 1 FROM public.usuario_permissoes_modulos upm
        WHERE upm.usuario_id = p_user_id AND upm.modulo_id = m.id
      )
    );
  END IF;

  IF v_departamento_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT t.codigo)
    INTO v_screens
    FROM public.telas_sistema t
    WHERE t.ativo = true
    AND (
      EXISTS (
        SELECT 1 FROM public.departamento_permissoes_telas dpt
        WHERE dpt.departamento_id = v_departamento_id AND dpt.tela_id = t.id
      )
      OR EXISTS (
        SELECT 1 FROM public.role_permissoes_telas rpt
        WHERE rpt.role = v_role::public.app_role AND rpt.tela_id = t.id
      )
      OR EXISTS (
        SELECT 1 FROM public.usuario_permissoes_telas upt
        WHERE upt.usuario_id = p_user_id AND upt.tela_id = t.id
      )
    );
  ELSE
    SELECT array_agg(DISTINCT t.codigo)
    INTO v_screens
    FROM public.telas_sistema t
    WHERE t.ativo = true
    AND (
      EXISTS (
        SELECT 1 FROM public.role_permissoes_telas rpt
        WHERE rpt.role = v_role::public.app_role AND rpt.tela_id = t.id
      )
      OR EXISTS (
        SELECT 1 FROM public.usuario_permissoes_telas upt
        WHERE upt.usuario_id = p_user_id AND upt.tela_id = t.id
      )
    );
  END IF;

  RETURN QUERY SELECT v_role, v_is_admin, COALESCE(v_modules, ARRAY[]::text[]), COALESCE(v_screens, ARRAY[]::text[]);
END;
$$;

-- Corrigir get_user_combined_module_permissions (fallback)
DROP FUNCTION IF EXISTS public.get_user_combined_module_permissions(uuid);
CREATE FUNCTION public.get_user_combined_module_permissions(_user_id uuid)
RETURNS TABLE(modulo_codigo character varying)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ms.codigo
  FROM public.modulos_sistema ms
  WHERE ms.ativo = true
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
  UNION
  SELECT ms.codigo
  FROM public.departamento_permissoes_modulos dpm
  JOIN public.modulos_sistema ms ON dpm.modulo_id = ms.id
  JOIN public.profiles p ON p.departamento_id = dpm.departamento_id
  WHERE p.id = _user_id
    AND ms.ativo = true
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
  UNION
  SELECT ms.codigo
  FROM public.role_permissoes_modulos rpm
  JOIN public.modulos_sistema ms ON rpm.modulo_id = ms.id
  JOIN public.user_roles ur ON rpm.role = ur.role
  WHERE ur.user_id = _user_id
    AND ms.ativo = true
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND departamento_id IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
  UNION
  SELECT ms.codigo
  FROM public.usuario_permissoes_modulos upm
  JOIN public.modulos_sistema ms ON upm.modulo_id = ms.id
  WHERE upm.usuario_id = _user_id
    AND ms.ativo = true;
$$;

-- Corrigir get_user_combined_screen_permissions (fallback)
DROP FUNCTION IF EXISTS public.get_user_combined_screen_permissions(uuid);
CREATE FUNCTION public.get_user_combined_screen_permissions(_user_id uuid)
RETURNS TABLE(tela_codigo character varying)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ts.codigo
  FROM public.telas_sistema ts
  WHERE ts.ativo = true
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
  UNION
  SELECT ts.codigo
  FROM public.departamento_permissoes_telas dpt
  JOIN public.telas_sistema ts ON dpt.tela_id = ts.id
  JOIN public.profiles p ON p.departamento_id = dpt.departamento_id
  WHERE p.id = _user_id
    AND ts.ativo = true
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
  UNION
  SELECT ts.codigo
  FROM public.role_permissoes_telas rpt
  JOIN public.telas_sistema ts ON rpt.tela_id = ts.id
  JOIN public.user_roles ur ON rpt.role = ur.role
  WHERE ur.user_id = _user_id
    AND ts.ativo = true
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND departamento_id IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
  UNION
  SELECT ts.codigo
  FROM public.usuario_permissoes_telas upt
  JOIN public.telas_sistema ts ON upt.tela_id = ts.id
  WHERE upt.usuario_id = _user_id
    AND ts.ativo = true;
$$;
