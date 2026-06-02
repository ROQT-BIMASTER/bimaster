-- Amplia regra central de acesso ao projeto para incluir projetos com visibilidade='equipe'
-- (visíveis para qualquer usuário autenticado), mantendo bloqueio para projetos privados/excluídos.
CREATE OR REPLACE FUNCTION public.user_can_access_projeto(_user_id uuid, _projeto_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _has_access boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT
    public.user_can_manage_all_projetos(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.projetos
      WHERE id = _projeto_id
        AND deleted_at IS NULL
        AND (
          criador_id = _user_id
          OR visibilidade = 'equipe'
        )
    )
    OR EXISTS (SELECT 1 FROM public.projeto_membros WHERE projeto_id = _projeto_id AND user_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.projeto_departamentos pd
      JOIN public.profiles pr ON pr.departamento_id = pd.departamento_id
      WHERE pd.projeto_id = _projeto_id AND pr.id = _user_id
    )
    OR EXISTS (
      SELECT 1 FROM public.projeto_tarefas t
      WHERE t.projeto_id = _projeto_id
        AND (t.criador_id = _user_id OR t.responsavel_id = _user_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.projeto_tarefa_colaboradores c
      JOIN public.projeto_tarefas t ON t.id = c.tarefa_id
      WHERE t.projeto_id = _projeto_id AND c.user_id = _user_id
    )
    OR EXISTS (
      SELECT 1 FROM public.projeto_tarefa_responsaveis r
      JOIN public.projeto_tarefas t ON t.id = r.tarefa_id
      WHERE t.projeto_id = _projeto_id AND r.user_id = _user_id
    )
    OR EXISTS (
      SELECT 1 FROM public.projeto_tarefa_seguidores s
      JOIN public.projeto_tarefas t ON t.id = s.tarefa_id
      WHERE t.projeto_id = _projeto_id AND s.user_id = _user_id
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
$function$;