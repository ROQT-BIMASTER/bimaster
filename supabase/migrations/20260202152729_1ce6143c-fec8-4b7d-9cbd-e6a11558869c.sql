-- Dropar e recriar função get_all_user_permissions com cast explícito para app_role
DROP FUNCTION IF EXISTS public.get_all_user_permissions(uuid);

CREATE OR REPLACE FUNCTION public.get_all_user_permissions(p_user_id uuid)
RETURNS TABLE (
  role text,
  is_admin boolean,
  modules text[],
  screens text[]
)
LANGUAGE plpgsql
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
  -- Buscar role do usuário
  SELECT ur.role::text INTO v_role
  FROM user_roles ur
  WHERE ur.user_id = p_user_id
  LIMIT 1;

  -- Default para vendedor se não tiver role
  v_role := COALESCE(v_role, 'vendedor');
  v_is_admin := (v_role = 'admin');

  -- Se for admin, retornar tudo
  IF v_is_admin THEN
    SELECT array_agg(DISTINCT m.codigo)
    INTO v_modules
    FROM modulos_sistema m
    WHERE m.ativo = true;

    SELECT array_agg(DISTINCT t.codigo)
    INTO v_screens
    FROM telas_sistema t
    WHERE t.ativo = true;

    RETURN QUERY SELECT v_role, v_is_admin, COALESCE(v_modules, ARRAY[]::text[]), COALESCE(v_screens, ARRAY[]::text[]);
    RETURN;
  END IF;

  -- Buscar departamento do usuário
  SELECT p.departamento_id INTO v_departamento_id
  FROM profiles p
  WHERE p.id = p_user_id;

  -- Buscar módulos: departamento + role + individuais
  IF v_departamento_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT m.codigo)
    INTO v_modules
    FROM modulos_sistema m
    WHERE m.ativo = true
    AND (
      -- Permissões do departamento
      EXISTS (
        SELECT 1 FROM departamento_permissoes_modulos dpm
        WHERE dpm.departamento_id = v_departamento_id
        AND dpm.modulo_id = m.id
      )
      OR
      -- Permissões do role
      EXISTS (
        SELECT 1 FROM role_permissoes_modulos rpm
        WHERE rpm.role = v_role::app_role
        AND rpm.modulo_id = m.id
      )
      OR
      -- Permissões individuais
      EXISTS (
        SELECT 1 FROM usuario_permissoes_modulos upm
        WHERE upm.usuario_id = p_user_id
        AND upm.modulo_id = m.id
      )
    );
  ELSE
    -- Sem departamento: role + individuais
    SELECT array_agg(DISTINCT m.codigo)
    INTO v_modules
    FROM modulos_sistema m
    WHERE m.ativo = true
    AND (
      -- Permissões do role
      EXISTS (
        SELECT 1 FROM role_permissoes_modulos rpm
        WHERE rpm.role = v_role::app_role
        AND rpm.modulo_id = m.id
      )
      OR
      -- Permissões individuais
      EXISTS (
        SELECT 1 FROM usuario_permissoes_modulos upm
        WHERE upm.usuario_id = p_user_id
        AND upm.modulo_id = m.id
      )
    );
  END IF;

  -- Buscar telas: departamento + role + individuais
  IF v_departamento_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT t.codigo)
    INTO v_screens
    FROM telas_sistema t
    WHERE t.ativo = true
    AND (
      -- Permissões do departamento
      EXISTS (
        SELECT 1 FROM departamento_permissoes_telas dpt
        WHERE dpt.departamento_id = v_departamento_id
        AND dpt.tela_id = t.id
      )
      OR
      -- Permissões do role
      EXISTS (
        SELECT 1 FROM role_permissoes_telas rpt
        WHERE rpt.role = v_role::app_role
        AND rpt.tela_id = t.id
      )
      OR
      -- Permissões individuais
      EXISTS (
        SELECT 1 FROM usuario_permissoes_telas upt
        WHERE upt.usuario_id = p_user_id
        AND upt.tela_id = t.id
      )
    );
  ELSE
    -- Sem departamento: role + individuais
    SELECT array_agg(DISTINCT t.codigo)
    INTO v_screens
    FROM telas_sistema t
    WHERE t.ativo = true
    AND (
      -- Permissões do role
      EXISTS (
        SELECT 1 FROM role_permissoes_telas rpt
        WHERE rpt.role = v_role::app_role
        AND rpt.tela_id = t.id
      )
      OR
      -- Permissões individuais
      EXISTS (
        SELECT 1 FROM usuario_permissoes_telas upt
        WHERE upt.usuario_id = p_user_id
        AND upt.tela_id = t.id
      )
    );
  END IF;

  RETURN QUERY SELECT v_role, v_is_admin, COALESCE(v_modules, ARRAY[]::text[]), COALESCE(v_screens, ARRAY[]::text[]);
END;
$$;