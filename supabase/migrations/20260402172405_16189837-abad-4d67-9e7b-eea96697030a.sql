DROP POLICY "Authenticated users can delete projetos" ON public.projetos;

CREATE POLICY "Members and admins can delete projetos" ON public.projetos
FOR DELETE TO authenticated
USING (
  criador_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM projeto_membros pm
    WHERE pm.projeto_id = projetos.id AND pm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
  )
);