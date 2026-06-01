CREATE OR REPLACE FUNCTION public.get_accessible_projetos(_target_user_id uuid DEFAULT NULL::uuid, _include_all boolean DEFAULT false)
 RETURNS SETOF public.projetos
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller_id uuid := auth.uid();
  _effective_user_id uuid := COALESCE(_target_user_id, auth.uid());
  _can_view_all boolean := false;
  _dept_projetos_id uuid := '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130'::uuid;
BEGIN
  IF _caller_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _caller_id
        AND ur.role = 'admin'::public.app_role
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.profiles pr ON pr.id = ur.user_id
      WHERE ur.user_id = _caller_id
        AND ur.role = 'gerente'::public.app_role
        AND pr.supervisor_id IS NULL
        AND pr.departamento_id = _dept_projetos_id
    )
  INTO _can_view_all;

  IF _target_user_id IS NOT NULL AND _target_user_id <> _caller_id AND NOT _can_view_all THEN
    RETURN;
  END IF;

  IF _include_all AND _can_view_all THEN
    RETURN QUERY
    SELECT p.*
    FROM public.projetos p
    WHERE p.deleted_at IS NULL
    ORDER BY p.created_at DESC;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.*
  FROM public.projetos p
  WHERE p.deleted_at IS NULL
    AND (
      p.criador_id = _effective_user_id
      OR EXISTS (
        SELECT 1
        FROM public.projeto_membros pm
        WHERE pm.projeto_id = p.id
          AND pm.user_id = _effective_user_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.projeto_departamentos pd
        JOIN public.profiles pr ON pr.departamento_id = pd.departamento_id
        WHERE pd.projeto_id = p.id
          AND pr.id = _effective_user_id
      )
    )
  ORDER BY p.created_at DESC;
END;
$function$;