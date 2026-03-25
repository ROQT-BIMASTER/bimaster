
-- projeto_briefings
DROP POLICY IF EXISTS "Users can update briefings" ON public.projeto_briefings;
CREATE POLICY "Users can update briefings" ON public.projeto_briefings
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

-- projeto_tarefa_metas
DROP POLICY IF EXISTS "Authenticated users can insert metas" ON public.projeto_tarefa_metas;
CREATE POLICY "Authenticated users can insert metas" ON public.projeto_tarefa_metas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update metas" ON public.projeto_tarefa_metas;
CREATE POLICY "Authenticated users can update metas" ON public.projeto_tarefa_metas
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete metas" ON public.projeto_tarefa_metas;
CREATE POLICY "Authenticated users can delete metas" ON public.projeto_tarefa_metas
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- projeto_tarefa_movimentacoes
DROP POLICY IF EXISTS "Users can create task movements" ON public.projeto_tarefa_movimentacoes;
CREATE POLICY "Users can create task movements" ON public.projeto_tarefa_movimentacoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- projeto_tarefa_produtos
DROP POLICY IF EXISTS "Authenticated users can insert tarefa produtos" ON public.projeto_tarefa_produtos;
CREATE POLICY "Authenticated users can insert tarefa produtos" ON public.projeto_tarefa_produtos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete tarefa produtos" ON public.projeto_tarefa_produtos;
CREATE POLICY "Authenticated users can delete tarefa produtos" ON public.projeto_tarefa_produtos
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- projetos
DROP POLICY IF EXISTS "Authenticated users can update projetos" ON public.projetos;
CREATE POLICY "Authenticated users can update projetos" ON public.projetos
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

-- tipos_anexo
DROP POLICY IF EXISTS "authenticated_insert_tipos_anexo" ON public.tipos_anexo;
CREATE POLICY "authenticated_insert_tipos_anexo" ON public.tipos_anexo
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- tipos_atividade_empresa
DROP POLICY IF EXISTS "authenticated_insert_tipos_atividade" ON public.tipos_atividade_empresa;
CREATE POLICY "authenticated_insert_tipos_atividade" ON public.tipos_atividade_empresa
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- tipos_entrega
DROP POLICY IF EXISTS "authenticated_insert_tipos_entrega" ON public.tipos_entrega;
CREATE POLICY "authenticated_insert_tipos_entrega" ON public.tipos_entrega
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_update_tipos_entrega" ON public.tipos_entrega;
CREATE POLICY "authenticated_update_tipos_entrega" ON public.tipos_entrega
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_delete_tipos_entrega" ON public.tipos_entrega;
CREATE POLICY "authenticated_delete_tipos_entrega" ON public.tipos_entrega
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
