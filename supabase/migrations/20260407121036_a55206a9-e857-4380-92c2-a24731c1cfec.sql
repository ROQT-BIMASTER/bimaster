
DROP POLICY IF EXISTS "Authenticated users can manage orcamentos alternativos" ON public.revisao_orcamentos_alternativos;

CREATE POLICY "revisao_orcamentos_select" ON public.revisao_orcamentos_alternativos
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "revisao_orcamentos_insert" ON public.revisao_orcamentos_alternativos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "revisao_orcamentos_update" ON public.revisao_orcamentos_alternativos
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'supervisor')
  );

CREATE POLICY "revisao_orcamentos_delete" ON public.revisao_orcamentos_alternativos
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'supervisor')
  );
