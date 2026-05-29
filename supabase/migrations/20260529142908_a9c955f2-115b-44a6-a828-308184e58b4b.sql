CREATE TABLE IF NOT EXISTS public.admin_escopo_limitado (
  user_id UUID NOT NULL PRIMARY KEY,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

GRANT SELECT ON public.admin_escopo_limitado TO authenticated;
GRANT ALL ON public.admin_escopo_limitado TO service_role;

ALTER TABLE public.admin_escopo_limitado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gerenciam escopo limitado" ON public.admin_escopo_limitado;
CREATE POLICY "Admins gerenciam escopo limitado"
ON public.admin_escopo_limitado
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Usuario ve seu proprio escopo limitado" ON public.admin_escopo_limitado;
CREATE POLICY "Usuario ve seu proprio escopo limitado"
ON public.admin_escopo_limitado
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

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

DROP FUNCTION IF EXISTS public.get_user_combined_module_permissions(uuid);
CREATE FUNCTION public.get_user_combined_module_permissions(_user_id uuid)
RETURNS TABLE(modulo_codigo varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ms.codigo FROM modulos_sistema ms
  WHERE ms.ativo = true
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin')
    AND NOT EXISTS (SELECT 1 FROM admin_escopo_limitado ael WHERE ael.user_id = _user_id)
  UNION
  SELECT ms.codigo FROM role_permissoes_modulos rpm
  JOIN modulos_sistema ms ON rpm.modulo_id = ms.id
  JOIN user_roles ur ON rpm.role = ur.role
  WHERE ur.user_id = _user_id AND ms.ativo = true
  UNION
  SELECT ms.codigo FROM usuario_permissoes_modulos upm
  JOIN modulos_sistema ms ON upm.modulo_id = ms.id
  WHERE upm.usuario_id = _user_id AND ms.ativo = true
  UNION
  SELECT ms.codigo FROM departamento_permissoes_modulos dpm
  JOIN modulos_sistema ms ON dpm.modulo_id = ms.id
  JOIN profiles p ON p.departamento_id = dpm.departamento_id
  WHERE p.id = _user_id AND ms.ativo = true;
$$;

DROP FUNCTION IF EXISTS public.get_user_combined_screen_permissions(uuid);
CREATE FUNCTION public.get_user_combined_screen_permissions(_user_id uuid)
RETURNS TABLE(tela_codigo varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ts.codigo FROM telas_sistema ts
  WHERE ts.ativo = true
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin')
    AND NOT EXISTS (SELECT 1 FROM admin_escopo_limitado ael WHERE ael.user_id = _user_id)
  UNION
  SELECT ts.codigo FROM role_permissoes_telas rpt
  JOIN telas_sistema ts ON rpt.tela_id = ts.id
  JOIN user_roles ur ON rpt.role = ur.role
  WHERE ur.user_id = _user_id AND ts.ativo = true
  UNION
  SELECT ts.codigo FROM usuario_permissoes_telas upt
  JOIN telas_sistema ts ON upt.tela_id = ts.id
  WHERE upt.usuario_id = _user_id AND ts.ativo = true
  UNION
  SELECT ts.codigo FROM departamento_permissoes_telas dpt
  JOIN telas_sistema ts ON dpt.tela_id = ts.id
  JOIN profiles p ON p.departamento_id = dpt.departamento_id
  WHERE p.id = _user_id AND ts.ativo = true;
$$;