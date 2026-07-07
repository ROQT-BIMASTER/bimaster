
CREATE OR REPLACE FUNCTION public.user_can_access_projeto(_user_id uuid, _projeto_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _project record;
BEGIN
  IF _user_id IS NULL OR _projeto_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT p.id, p.criador_id, p.visibilidade, p.deleted_at
    INTO _project
  FROM public.projetos p
  WHERE p.id = _projeto_id;

  IF _project.id IS NULL OR _project.deleted_at IS NOT NULL THEN
    RETURN false;
  END IF;

  -- Criador sempre acessa
  IF _project.criador_id = _user_id THEN
    RETURN true;
  END IF;

  -- Visibilidade explicitamente pública/organização: qualquer autenticado vê
  IF _project.visibilidade IN ('publica','organizacao','todos') THEN
    RETURN true;
  END IF;

  -- Admin vê todos
  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = 'admin'::public.app_role
  ) THEN
    RETURN true;
  END IF;

  -- Gerente sem supervisor do departamento raiz
  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles pr ON pr.id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'gerente'::public.app_role
      AND pr.supervisor_id IS NULL
      AND pr.departamento_id = '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130'::uuid
  ) THEN
    RETURN true;
  END IF;

  -- Membro explícito
  IF EXISTS (
    SELECT 1
    FROM public.projeto_membros pm
    WHERE pm.projeto_id = _projeto_id
      AND pm.user_id = _user_id
  ) THEN
    RETURN true;
  END IF;

  -- Departamento vinculado ao projeto
  IF EXISTS (
    SELECT 1
    FROM public.projeto_departamentos pd
    JOIN public.profiles pr ON pr.departamento_id = pd.departamento_id
    WHERE pd.projeto_id = _projeto_id
      AND pr.id = _user_id
  ) THEN
    RETURN true;
  END IF;

  -- Criador ou responsável de tarefa
  IF EXISTS (
    SELECT 1
    FROM public.projeto_tarefas t
    WHERE t.projeto_id = _projeto_id
      AND t.excluida_em IS NULL
      AND (t.criador_id = _user_id OR t.responsavel_id = _user_id)
  ) THEN
    RETURN true;
  END IF;

  -- Colaborador de tarefa
  IF EXISTS (
    SELECT 1
    FROM public.projeto_tarefa_colaboradores c
    JOIN public.projeto_tarefas t ON t.id = c.tarefa_id
    WHERE t.projeto_id = _projeto_id
      AND t.excluida_em IS NULL
      AND c.user_id = _user_id
  ) THEN
    RETURN true;
  END IF;

  -- Responsável adicional
  IF EXISTS (
    SELECT 1
    FROM public.projeto_tarefa_responsaveis r
    JOIN public.projeto_tarefas t ON t.id = r.tarefa_id
    WHERE t.projeto_id = _projeto_id
      AND t.excluida_em IS NULL
      AND r.user_id = _user_id
  ) THEN
    RETURN true;
  END IF;

  -- Seguidor de tarefa
  IF EXISTS (
    SELECT 1
    FROM public.projeto_tarefa_seguidores s
    JOIN public.projeto_tarefas t ON t.id = s.tarefa_id
    WHERE t.projeto_id = _projeto_id
      AND t.excluida_em IS NULL
      AND s.user_id = _user_id
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;
