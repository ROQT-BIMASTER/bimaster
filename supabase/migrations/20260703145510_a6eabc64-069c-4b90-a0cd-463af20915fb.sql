
-- 1. Nova função estrita: membro real do projeto
CREATE OR REPLACE FUNCTION public.user_is_projeto_member(_user_id uuid, _projeto_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project record;
BEGIN
  IF _user_id IS NULL OR _projeto_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT p.id, p.criador_id, p.deleted_at
    INTO _project
  FROM public.projetos p
  WHERE p.id = _projeto_id;

  IF _project.id IS NULL OR _project.deleted_at IS NOT NULL THEN
    -- Admin ainda pode ver projetos soft-deleted (auditoria)
    IF EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id AND ur.role = 'admin'::public.app_role) THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;

  -- Criador
  IF _project.criador_id = _user_id THEN
    RETURN true;
  END IF;

  -- Admin global
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = 'admin'::public.app_role
  ) THEN
    RETURN true;
  END IF;

  -- Gerente geral do depto Projetos
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

  -- Membro atual
  IF EXISTS (
    SELECT 1 FROM public.projeto_membros pm
    WHERE pm.projeto_id = _projeto_id AND pm.user_id = _user_id
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_is_projeto_member(uuid, uuid) TO authenticated, service_role;

-- 2. Reescrever policies de projeto_atividades
DROP POLICY IF EXISTS "Members can view project activities" ON public.projeto_atividades;
DROP POLICY IF EXISTS "Members can insert project activities" ON public.projeto_atividades;
DROP POLICY IF EXISTS "Members can update project activities" ON public.projeto_atividades;

CREATE POLICY "Members can view project activities"
ON public.projeto_atividades
FOR SELECT
TO authenticated
USING (public.user_is_projeto_member((SELECT auth.uid()), projeto_id));

CREATE POLICY "Members can insert project activities"
ON public.projeto_atividades
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND public.user_is_projeto_member((SELECT auth.uid()), projeto_id)
);

CREATE POLICY "Members can update project activities"
ON public.projeto_atividades
FOR UPDATE
TO authenticated
USING (public.user_is_projeto_member((SELECT auth.uid()), projeto_id))
WITH CHECK (public.user_is_projeto_member((SELECT auth.uid()), projeto_id));

-- 3. Higienização: remover atividades órfãs (projetos deletados/inexistentes)
DELETE FROM public.projeto_atividades pa
WHERE NOT EXISTS (
  SELECT 1 FROM public.projetos p
  WHERE p.id = pa.projeto_id AND p.deleted_at IS NULL
);
