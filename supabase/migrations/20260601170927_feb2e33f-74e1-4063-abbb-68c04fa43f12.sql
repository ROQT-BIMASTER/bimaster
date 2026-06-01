DROP POLICY IF EXISTS "Members can update projetos" ON public.projetos;
DROP POLICY IF EXISTS "Members and admins can delete projetos" ON public.projetos;

CREATE POLICY "Accessible users can update projetos"
ON public.projetos
FOR UPDATE
TO authenticated
USING (public.user_can_access_projeto(auth.uid(), id))
WITH CHECK (public.user_can_access_projeto(auth.uid(), id));

CREATE POLICY "Accessible users can delete projetos"
ON public.projetos
FOR DELETE
TO authenticated
USING (public.user_can_access_projeto(auth.uid(), id));