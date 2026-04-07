
CREATE OR REPLACE FUNCTION public.check_user_access(_user_id uuid, _module_code text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  _role text;
  _department_id uuid;
BEGIN
  SELECT ur.role::text, p.departamento_id
  INTO _role, _department_id
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.user_id = _user_id
  LIMIT 1;

  IF _role = 'admin' THEN RETURN true; END IF;
  IF _module_code IS NULL THEN RETURN _role IN ('supervisor', 'gerente'); END IF;
  IF _role IN ('supervisor', 'gerente') THEN RETURN true; END IF;

  IF EXISTS (
    SELECT 1 FROM public.usuario_permissoes_modulos upm
    JOIN public.modulos_sistema ms ON ms.id = upm.modulo_id
    WHERE upm.usuario_id = _user_id AND ms.codigo = _module_code AND ms.ativo = true
  ) THEN RETURN true; END IF;

  IF _department_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.departamento_permissoes_modulos dpm
    JOIN public.modulos_sistema ms ON ms.id = dpm.modulo_id
    WHERE dpm.departamento_id = _department_id AND ms.codigo = _module_code AND ms.ativo = true
  ) THEN RETURN true; END IF;

  IF _role IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.role_permissoes_modulos rpm
    JOIN public.modulos_sistema ms ON ms.id = rpm.modulo_id
    WHERE rpm.role = _role::public.app_role AND ms.codigo = _module_code AND ms.ativo = true
  ) THEN RETURN true; END IF;

  RETURN false;
END;
$function$;
