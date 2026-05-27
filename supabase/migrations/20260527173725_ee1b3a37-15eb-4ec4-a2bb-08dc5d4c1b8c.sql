
-- Helper SECURITY DEFINER functions to break RLS recursion on projeto_membros
CREATE OR REPLACE FUNCTION public.user_is_project_member(_user_id uuid, _projeto_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projeto_membros
    WHERE projeto_id = _projeto_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_project_coordinator(_user_id uuid, _projeto_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projeto_membros
    WHERE projeto_id = _projeto_id
      AND user_id = _user_id
      AND papel IN ('coordenador', 'gestor_produto', 'gerente')
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_project_members(_user_id uuid, _projeto_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'gerente'::app_role)
    OR EXISTS (SELECT 1 FROM public.projetos WHERE id = _projeto_id AND criador_id = _user_id)
    OR public.user_is_project_coordinator(_user_id, _projeto_id);
$$;

REVOKE ALL ON FUNCTION public.user_is_project_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_is_project_coordinator(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_can_manage_project_members(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_is_project_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_is_project_coordinator(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_manage_project_members(uuid, uuid) TO authenticated, service_role;

-- Replace recursive policies on projeto_membros
DROP POLICY IF EXISTS "Manage project members" ON public.projeto_membros;
DROP POLICY IF EXISTS "Delete project members" ON public.projeto_membros;
DROP POLICY IF EXISTS "Coordinators manage members" ON public.projeto_membros;
DROP POLICY IF EXISTS "Coordinators delete members" ON public.projeto_membros;
DROP POLICY IF EXISTS "pm_update" ON public.projeto_membros;

CREATE POLICY "Manage project members"
ON public.projeto_membros
FOR INSERT TO authenticated
WITH CHECK (public.user_can_manage_project_members((SELECT auth.uid()), projeto_id));

CREATE POLICY "Delete project members"
ON public.projeto_membros
FOR DELETE TO authenticated
USING (public.user_can_manage_project_members((SELECT auth.uid()), projeto_id));

CREATE POLICY "Update project members"
ON public.projeto_membros
FOR UPDATE TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.user_can_manage_project_members((SELECT auth.uid()), projeto_id)
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  OR public.user_can_manage_project_members((SELECT auth.uid()), projeto_id)
);

-- Rewrite projeto_membro_secoes policies to use the helper (avoid self-join on projeto_membros recursion)
DROP POLICY IF EXISTS "Manage section assignments" ON public.projeto_membro_secoes;
DROP POLICY IF EXISTS "Delete section assignments" ON public.projeto_membro_secoes;
DROP POLICY IF EXISTS "Coordinators manage section assignments" ON public.projeto_membro_secoes;
DROP POLICY IF EXISTS "Coordinators delete section assignments" ON public.projeto_membro_secoes;

CREATE POLICY "Manage section assignments"
ON public.projeto_membro_secoes
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projeto_membros pm
    WHERE pm.id = membro_id
      AND public.user_can_manage_project_members((SELECT auth.uid()), pm.projeto_id)
  )
);

CREATE POLICY "Delete section assignments"
ON public.projeto_membro_secoes
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projeto_membros pm
    WHERE pm.id = membro_id
      AND public.user_can_manage_project_members((SELECT auth.uid()), pm.projeto_id)
  )
);
