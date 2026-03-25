
-- fabrica_produtos_historico
DROP POLICY IF EXISTS "System can insert product history" ON public.fabrica_produtos_historico;
CREATE POLICY "System can insert product history" ON public.fabrica_produtos_historico
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- fabrica_tax_rates_iva (different names)
DROP POLICY IF EXISTS "Authenticated users can insert tax rates iva" ON public.fabrica_tax_rates_iva;
CREATE POLICY "Authenticated users can insert tax rates iva" ON public.fabrica_tax_rates_iva
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update tax rates iva" ON public.fabrica_tax_rates_iva;
CREATE POLICY "Authenticated users can update tax rates iva" ON public.fabrica_tax_rates_iva
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete tax rates iva" ON public.fabrica_tax_rates_iva;
CREATE POLICY "Authenticated users can delete tax rates iva" ON public.fabrica_tax_rates_iva
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- financial_payment_queue_history
DROP POLICY IF EXISTS "Authenticated users can insert history" ON public.financial_payment_queue_history;
CREATE POLICY "Authenticated users can insert history" ON public.financial_payment_queue_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- fluxo_aprovacao_anexos
DROP POLICY IF EXISTS "Authenticated can insert anexos" ON public.fluxo_aprovacao_anexos;
CREATE POLICY "Authenticated can insert anexos" ON public.fluxo_aprovacao_anexos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can update anexos" ON public.fluxo_aprovacao_anexos;
CREATE POLICY "Authenticated can update anexos" ON public.fluxo_aprovacao_anexos
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- fluxo_aprovacao_aprovadores
DROP POLICY IF EXISTS "Authenticated can insert approvers" ON public.fluxo_aprovacao_aprovadores;
CREATE POLICY "Authenticated can insert approvers" ON public.fluxo_aprovacao_aprovadores
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- fluxo_aprovacao_instancias
DROP POLICY IF EXISTS "Authenticated can insert instances" ON public.fluxo_aprovacao_instancias;
CREATE POLICY "Authenticated can insert instances" ON public.fluxo_aprovacao_instancias
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can update instances" ON public.fluxo_aprovacao_instancias;
CREATE POLICY "Authenticated can update instances" ON public.fluxo_aprovacao_instancias
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- fluxo_aprovacao_transicoes
DROP POLICY IF EXISTS "Authenticated can insert transitions" ON public.fluxo_aprovacao_transicoes;
CREATE POLICY "Authenticated can insert transitions" ON public.fluxo_aprovacao_transicoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- fluxo_aprovacao_vinculos
DROP POLICY IF EXISTS "Authenticated can insert vinculos" ON public.fluxo_aprovacao_vinculos;
CREATE POLICY "Authenticated can insert vinculos" ON public.fluxo_aprovacao_vinculos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can delete vinculos" ON public.fluxo_aprovacao_vinculos;
CREATE POLICY "Authenticated can delete vinculos" ON public.fluxo_aprovacao_vinculos
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- meeting tables
DROP POLICY IF EXISTS "mi_insert" ON public.meeting_insights;
CREATE POLICY "mi_insert" ON public.meeting_insights
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "mr_insert" ON public.meeting_risks;
CREATE POLICY "mr_insert" ON public.meeting_risks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "mt_insert" ON public.meeting_tasks;
CREATE POLICY "mt_insert" ON public.meeting_tasks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- notificacoes
DROP POLICY IF EXISTS "Service can insert notifications" ON public.notificacoes;
CREATE POLICY "Service can insert notifications" ON public.notificacoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- paises
DROP POLICY IF EXISTS "authenticated_insert_paises" ON public.paises;
CREATE POLICY "authenticated_insert_paises" ON public.paises
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- parcelas_condicoes
DROP POLICY IF EXISTS "authenticated_insert_parcelas_condicoes" ON public.parcelas_condicoes;
CREATE POLICY "authenticated_insert_parcelas_condicoes" ON public.parcelas_condicoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- process_doc_workflow_transicoes
DROP POLICY IF EXISTS "Authenticated can insert doc workflow transicoes" ON public.process_doc_workflow_transicoes;
CREATE POLICY "Authenticated can insert doc workflow transicoes" ON public.process_doc_workflow_transicoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- process_juntadas
DROP POLICY IF EXISTS "Authenticated users can insert juntadas" ON public.process_juntadas;
CREATE POLICY "Authenticated users can insert juntadas" ON public.process_juntadas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update juntadas" ON public.process_juntadas;
CREATE POLICY "Authenticated users can update juntadas" ON public.process_juntadas
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- process_tipos_documento
DROP POLICY IF EXISTS "Authenticated users can insert tipos_documento" ON public.process_tipos_documento;
CREATE POLICY "Authenticated users can insert tipos_documento" ON public.process_tipos_documento
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update tipos_documento" ON public.process_tipos_documento;
CREATE POLICY "Authenticated users can update tipos_documento" ON public.process_tipos_documento
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_aprovacoes_fisicas
DROP POLICY IF EXISTS "Auth can insert aprovacoes_fisicas" ON public.produto_aprovacoes_fisicas;
CREATE POLICY "Auth can insert aprovacoes_fisicas" ON public.produto_aprovacoes_fisicas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth can update aprovacoes_fisicas" ON public.produto_aprovacoes_fisicas;
CREATE POLICY "Auth can update aprovacoes_fisicas" ON public.produto_aprovacoes_fisicas
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_brasil_pasta_digital
DROP POLICY IF EXISTS "Authenticated users can insert pasta digital" ON public.produto_brasil_pasta_digital;
CREATE POLICY "Authenticated users can insert pasta digital" ON public.produto_brasil_pasta_digital
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update pasta digital" ON public.produto_brasil_pasta_digital;
CREATE POLICY "Authenticated users can update pasta digital" ON public.produto_brasil_pasta_digital
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete pasta digital" ON public.produto_brasil_pasta_digital;
CREATE POLICY "Authenticated users can delete pasta digital" ON public.produto_brasil_pasta_digital
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- produto_rnc
DROP POLICY IF EXISTS "Auth can insert produto_rnc" ON public.produto_rnc;
CREATE POLICY "Auth can insert produto_rnc" ON public.produto_rnc
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth can update produto_rnc" ON public.produto_rnc;
CREATE POLICY "Auth can update produto_rnc" ON public.produto_rnc
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_testes
DROP POLICY IF EXISTS "Auth can insert produto_testes" ON public.produto_testes;
CREATE POLICY "Auth can insert produto_testes" ON public.produto_testes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth can update produto_testes" ON public.produto_testes;
CREATE POLICY "Auth can update produto_testes" ON public.produto_testes
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth can delete produto_testes" ON public.produto_testes;
CREATE POLICY "Auth can delete produto_testes" ON public.produto_testes
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- session_invalidation_queue
DROP POLICY IF EXISTS "Anyone can insert invalidation" ON public.session_invalidation_queue;
CREATE POLICY "Anyone can insert invalidation" ON public.session_invalidation_queue
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- ui_permissions_audit
DROP POLICY IF EXISTS "authenticated_insert_ui_perm_audit" ON public.ui_permissions_audit;
CREATE POLICY "authenticated_insert_ui_perm_audit" ON public.ui_permissions_audit
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
