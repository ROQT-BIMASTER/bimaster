
DROP POLICY IF EXISTS "Authenticated users can view projetos" ON public.projetos;

CREATE POLICY "Users view own or member projetos" ON public.projetos
  FOR SELECT TO authenticated
  USING (
    criador_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projeto_membros pm
      WHERE pm.projeto_id = id AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Authenticated users can update projetos" ON public.projetos;

CREATE POLICY "Members can update projetos" ON public.projetos
  FOR UPDATE TO authenticated
  USING (
    criador_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projeto_membros pm
      WHERE pm.projeto_id = id AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );
