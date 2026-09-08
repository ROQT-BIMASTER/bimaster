CREATE OR REPLACE FUNCTION public.get_all_user_permissions(p_user_id uuid)
 RETURNS TABLE(role text, is_admin boolean, modules text[], screens text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_is_admin boolean;
  v_scope_limited boolean;
  v_modules text[];
  v_screens text[];
  v_departamento_id uuid;
BEGIN
  SELECT ur.role::text INTO v_role
  FROM public.user_roles ur
  WHERE ur.user_id = p_user_id
  ORDER BY CASE ur.role::text
    WHEN 'admin' THEN 1
    WHEN 'gerente' THEN 2
    WHEN 'supervisor' THEN 3
    WHEN 'consultor' THEN 4
    WHEN 'marketing' THEN 5
    WHEN 'suporte' THEN 6
    WHEN 'vendedor' THEN 7
    WHEN 'promotora' THEN 8
    WHEN 'promotor' THEN 9
    WHEN 'cliente' THEN 10
    ELSE 99
  END
  LIMIT 1;

  v_role := COALESCE(v_role, 'vendedor');
  v_is_admin := (v_role = 'admin');

  SELECT EXISTS (
    SELECT 1 FROM public.admin_escopo_limitado ael
    WHERE ael.user_id = p_user_id
  ) INTO v_scope_limited;

  IF v_is_admin AND NOT v_scope_limited THEN
    SELECT array_agg(DISTINCT m.codigo) INTO v_modules
    FROM public.modulos_sistema m WHERE m.ativo = true;

    SELECT array_agg(DISTINCT t.codigo) INTO v_screens
    FROM public.telas_sistema t WHERE t.ativo = true;

    RETURN QUERY SELECT v_role, v_is_admin, COALESCE(v_modules, ARRAY[]::text[]), COALESCE(v_screens, ARRAY[]::text[]);
    RETURN;
  END IF;

  SELECT p.departamento_id INTO v_departamento_id
  FROM public.profiles p WHERE p.id = p_user_id;

  SELECT array_agg(DISTINCT m.codigo) INTO v_modules
  FROM public.modulos_sistema m
  WHERE m.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM public.usuario_modulos_negados umn
      WHERE umn.usuario_id = p_user_id AND umn.modulo_id = m.id
    )
    AND (
      (v_departamento_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.departamento_permissoes_modulos dpm
        WHERE dpm.departamento_id = v_departamento_id AND dpm.modulo_id = m.id
      ))
      OR EXISTS (
        SELECT 1 FROM public.role_permissoes_modulos rpm
        WHERE rpm.role = v_role::public.app_role AND rpm.modulo_id = m.id
      )
      OR EXISTS (
        SELECT 1 FROM public.usuario_permissoes_modulos upm
        WHERE upm.usuario_id = p_user_id AND upm.modulo_id = m.id
      )
    );

  SELECT array_agg(DISTINCT t.codigo) INTO v_screens
  FROM public.telas_sistema t
  WHERE t.ativo = true
    AND (
      (v_departamento_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.departamento_permissoes_telas dpt
        WHERE dpt.departamento_id = v_departamento_id AND dpt.tela_id = t.id
      ))
      OR EXISTS (
        SELECT 1 FROM public.role_permissoes_telas rpt
        WHERE rpt.role = v_role::public.app_role AND rpt.tela_id = t.id
      )
      OR EXISTS (
        SELECT 1 FROM public.usuario_permissoes_telas upt
        WHERE upt.usuario_id = p_user_id AND upt.tela_id = t.id
      )
    );

  IF v_is_admin AND v_scope_limited THEN
    v_screens := COALESCE(v_screens, ARRAY[]::text[]) || ARRAY['admin','auditoria','configuracoes','config_geral','config_storage']::text[];
    v_screens := ARRAY(SELECT DISTINCT unnest(v_screens));
    v_is_admin := false;
  END IF;

  RETURN QUERY SELECT v_role, v_is_admin, COALESCE(v_modules, ARRAY[]::text[]), COALESCE(v_screens, ARRAY[]::text[]);
END;
$function$;

DELETE FROM public.user_roles
WHERE user_id = '58802863-68f2-4802-84f9-7e1a8c54a558'
  AND role = 'gerente';