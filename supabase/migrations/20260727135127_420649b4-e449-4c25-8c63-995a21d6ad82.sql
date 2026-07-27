CREATE OR REPLACE FUNCTION public.is_supervisor_of(_supervisor_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN EXISTS (
    WITH RECURSIVE hierarchy AS (
      SELECT id, supervisor_id
      FROM public.profiles
      WHERE id = _user_id

      UNION ALL

      SELECT p.id, p.supervisor_id
      FROM public.profiles p
      INNER JOIN hierarchy h ON p.id = h.supervisor_id
    )
    SELECT 1 FROM hierarchy WHERE id = _supervisor_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_access_ads_account(viewer_id uuid, account_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  viewer_role public.app_role;
BEGIN
  IF viewer_id = account_user_id THEN
    RETURN true;
  END IF;

  SELECT role INTO viewer_role
  FROM public.user_roles
  WHERE user_id = viewer_id
  LIMIT 1;

  IF viewer_role = 'admin' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_access_notas_fiscais(viewer_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  viewer_role public.app_role;
BEGIN
  SELECT role INTO viewer_role
  FROM public.user_roles
  WHERE user_id = viewer_id
  LIMIT 1;

  IF viewer_role = 'admin' THEN
    RETURN true;
  END IF;

  IF viewer_role = 'supervisor' THEN
    IF public.usuario_tem_acesso_modulo(viewer_id, 'fabrica') OR
       public.usuario_tem_acesso_modulo(viewer_id, 'financeiro') THEN
      RETURN true;
    END IF;
  END IF;

  IF public.usuario_tem_acesso_modulo(viewer_id, 'fabrica') THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_access_payment_queue(_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    LEFT JOIN public.departamentos d ON p.departamento_id = d.id
    WHERE p.id = _user_id
    AND (
      d.nome ILIKE '%Financeiro%'
      OR d.nome ILIKE '%Tesouraria%'
      OR d.nome ILIKE '%Controladoria%'
    )
  )
  OR public.has_role(_user_id, 'admin');
END;
$function$;

CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_tela(_user_id uuid, _tela_codigo text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_role TEXT;
  v_department_id UUID;
  v_has_access BOOLEAN;
BEGIN
  IF public.has_role(_user_id, 'admin') THEN
    RETURN TRUE;
  END IF;

  SELECT p.departamento_id INTO v_department_id FROM public.profiles p WHERE p.id = _user_id;

  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_permissoes_telas upt
    JOIN public.telas_sistema t ON t.id = upt.tela_id
    WHERE upt.usuario_id = _user_id
      AND t.codigo = _tela_codigo
      AND t.ativo = true
  ) INTO v_has_access;

  IF v_has_access THEN
    RETURN TRUE;
  END IF;

  IF v_department_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.departamento_permissoes_telas dpt
      JOIN public.telas_sistema t ON t.id = dpt.tela_id
      WHERE dpt.departamento_id = v_department_id
        AND t.codigo = _tela_codigo
        AND t.ativo = true
    ) INTO v_has_access;

    IF v_has_access THEN
      RETURN TRUE;
    END IF;
  END IF;

  SELECT ur.role::text INTO v_role FROM public.user_roles ur WHERE ur.user_id = _user_id LIMIT 1;

  IF v_role IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.role_permissoes_telas rpt
      JOIN public.telas_sistema t ON t.id = rpt.tela_id
      WHERE rpt.role::text = v_role
        AND t.codigo = _tela_codigo
        AND t.ativo = true
    ) INTO v_has_access;

    RETURN v_has_access;
  END IF;

  RETURN FALSE;
END;
$function$;