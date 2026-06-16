
-- 1) fabrica_produto_visibility_blocks: restrict INSERT/DELETE to admin/supervisor
DROP POLICY IF EXISTS "Admins can insert blocks" ON public.fabrica_produto_visibility_blocks;
DROP POLICY IF EXISTS "Admins can delete blocks" ON public.fabrica_produto_visibility_blocks;
CREATE POLICY "Admins/supervisors can insert blocks"
  ON public.fabrica_produto_visibility_blocks FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Admins/supervisors can delete blocks"
  ON public.fabrica_produto_visibility_blocks FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));

-- 2) process_etapas_config: split ALL into admin/gerente writes
DROP POLICY IF EXISTS "Authenticated users can manage etapas config" ON public.process_etapas_config;
CREATE POLICY "Admins/gerentes manage etapas config"
  ON public.process_etapas_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'));

-- 3) process_doc_workflow_etapas: restrict writes
DROP POLICY IF EXISTS "Authenticated can manage doc workflow etapas" ON public.process_doc_workflow_etapas;
CREATE POLICY "Admins/gerentes manage doc workflow etapas"
  ON public.process_doc_workflow_etapas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'));

-- 4) process_doc_workflow_instancias: restrict writes
DROP POLICY IF EXISTS "Authenticated can manage doc workflow instancias" ON public.process_doc_workflow_instancias;
CREATE POLICY "Admins/gerentes manage doc workflow instancias"
  ON public.process_doc_workflow_instancias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'));

-- 5) china_ficha_despachos: restrict INSERT to admin/supervisor/gerente
DROP POLICY IF EXISTS "Authenticated users can insert despachos" ON public.china_ficha_despachos;
CREATE POLICY "Admins/supervisors/gerentes insert despachos"
  ON public.china_ficha_despachos FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_role(auth.uid(), 'gerente')
  );

-- 6) processo_instancia_tarefa_gerada: tighten INSERT to admin/gerente or creator of instancia
DROP POLICY IF EXISTS "pitg_insert_auth" ON public.processo_instancia_tarefa_gerada;
CREATE POLICY "pitg_insert_scoped"
  ON public.processo_instancia_tarefa_gerada FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
    OR instancia_id IN (
      SELECT id FROM public.processo_instancias WHERE created_by = auth.uid()
    )
  );

-- 7) copilot_index_queue: add admin-only policy (RLS enabled, no policy = SUPA lint info)
CREATE POLICY "Admins manage copilot index queue"
  ON public.copilot_index_queue FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8) Views without security_invoker → switch to invoker semantics
ALTER VIEW public.vw_conciliacao_cores_unificado SET (security_invoker = true);
ALTER VIEW public.vw_divergencia_linha_erp SET (security_invoker = true);
