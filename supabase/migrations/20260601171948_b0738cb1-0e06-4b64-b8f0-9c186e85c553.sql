CREATE OR REPLACE FUNCTION public.user_can_manage_all_projetos(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = 'admin'::public.app_role
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles pr ON pr.id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'gerente'::public.app_role
      AND pr.supervisor_id IS NULL
      AND pr.departamento_id = '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130'::uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_projeto(_user_id uuid, _projeto_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _has_access boolean;
BEGIN
  SELECT
    public.user_can_manage_all_projetos(_user_id)
    OR EXISTS (SELECT 1 FROM public.projetos WHERE id = _projeto_id AND criador_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.projeto_membros WHERE projeto_id = _projeto_id AND user_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.projeto_departamentos pd
      JOIN public.profiles pr ON pr.departamento_id = pd.departamento_id
      WHERE pd.projeto_id = _projeto_id AND pr.id = _user_id
    )
  INTO _has_access;

  IF NOT COALESCE(_has_access, false) THEN
    BEGIN
      INSERT INTO public.security_audit_log (action, severity, user_id, metadata)
      VALUES (
        'project_access_denied',
        'warn',
        _user_id,
        jsonb_build_object(
          'projeto_id', _projeto_id,
          'user_departamento_id', (SELECT departamento_id FROM public.profiles WHERE id = _user_id),
          'projeto_departamentos', (SELECT coalesce(array_agg(departamento_id), ARRAY[]::uuid[]) FROM public.projeto_departamentos WHERE projeto_id = _projeto_id)
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN COALESCE(_has_access, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_soft_delete_projeto(p_projeto_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.user_can_access_projeto(v_uid, p_projeto_id) THEN
    RAISE EXCEPTION 'Sem permissão para excluir este projeto';
  END IF;

  UPDATE public.projetos
  SET deleted_at = COALESCE(deleted_at, now()),
      updated_at = now()
  WHERE id = p_projeto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.user_can_manage_all_projetos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_manage_all_projetos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_manage_all_projetos(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_soft_delete_projeto(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_soft_delete_projeto(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_soft_delete_projeto(uuid) TO service_role;