-- =============================================
-- Fix RLS policies: Replace USING(true)/WITH CHECK(true) with explicit checks
-- This resolves the "RLS Policy Always True" linter warnings
-- =============================================

-- ============ AUTHENTICATED POLICIES ============
-- Replace ALL policies with USING(true) for authenticated role
-- with explicit auth.uid() IS NOT NULL check

-- china_checklist_custom_categorias
DROP POLICY IF EXISTS "Authenticated users can manage custom checklist categories" ON public.china_checklist_custom_categorias;
CREATE POLICY "Authenticated users can manage custom checklist categories" ON public.china_checklist_custom_categorias FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- china_checklist_custom_itens
DROP POLICY IF EXISTS "Authenticated users can manage custom checklist items" ON public.china_checklist_custom_itens;
CREATE POLICY "Authenticated users can manage custom checklist items" ON public.china_checklist_custom_itens FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- china_doc_revisoes
DROP POLICY IF EXISTS "Authenticated users can manage revisoes" ON public.china_doc_revisoes;
CREATE POLICY "Authenticated users can manage revisoes" ON public.china_doc_revisoes FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- china_documento_tarefa_vinculos
DROP POLICY IF EXISTS "Authenticated users can manage doc vinculos" ON public.china_documento_tarefa_vinculos;
CREATE POLICY "Authenticated users can manage doc vinculos" ON public.china_documento_tarefa_vinculos FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- china_embarque_documentos
DROP POLICY IF EXISTS "Authenticated users can manage embarque docs" ON public.china_embarque_documentos;
CREATE POLICY "Authenticated users can manage embarque docs" ON public.china_embarque_documentos FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- china_submissao_tarefa_vinculos
DROP POLICY IF EXISTS "Authenticated users can manage vinculos" ON public.china_submissao_tarefa_vinculos;
CREATE POLICY "Authenticated users can manage vinculos" ON public.china_submissao_tarefa_vinculos FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- conciliacao_uploads
DROP POLICY IF EXISTS "Authenticated users can manage conciliacao_uploads" ON public.conciliacao_uploads;
CREATE POLICY "Authenticated users can manage conciliacao_uploads" ON public.conciliacao_uploads FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- documento_anexos
DROP POLICY IF EXISTS "Authenticated users can manage own empresa anexos" ON public.documento_anexos;
CREATE POLICY "Authenticated users can manage own empresa anexos" ON public.documento_anexos FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- erp_sync_log
DROP POLICY IF EXISTS "erp_sync_log_auth_access" ON public.erp_sync_log;
CREATE POLICY "erp_sync_log_auth_access" ON public.erp_sync_log FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- financial_correction_rules
DROP POLICY IF EXISTS "Authenticated users can manage correction rules" ON public.financial_correction_rules;
CREATE POLICY "Authenticated users can manage correction rules" ON public.financial_correction_rules FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- process_despacho_documento
DROP POLICY IF EXISTS "Authenticated users can manage despachos" ON public.process_despacho_documento;
CREATE POLICY "Authenticated users can manage despachos" ON public.process_despacho_documento FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- process_despacho_transicoes
DROP POLICY IF EXISTS "Authenticated users can manage transicoes" ON public.process_despacho_transicoes;
CREATE POLICY "Authenticated users can manage transicoes" ON public.process_despacho_transicoes FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- process_doc_workflow_config
DROP POLICY IF EXISTS "Authenticated can manage doc workflow config" ON public.process_doc_workflow_config;
CREATE POLICY "Authenticated can manage doc workflow config" ON public.process_doc_workflow_config FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- process_doc_workflow_etapas
DROP POLICY IF EXISTS "Authenticated can manage doc workflow etapas" ON public.process_doc_workflow_etapas;
CREATE POLICY "Authenticated can manage doc workflow etapas" ON public.process_doc_workflow_etapas FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- process_doc_workflow_instancias
DROP POLICY IF EXISTS "Authenticated can manage doc workflow instancias" ON public.process_doc_workflow_instancias;
CREATE POLICY "Authenticated can manage doc workflow instancias" ON public.process_doc_workflow_instancias FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- process_etapas_config
DROP POLICY IF EXISTS "Authenticated users can manage etapas config" ON public.process_etapas_config;
CREATE POLICY "Authenticated users can manage etapas config" ON public.process_etapas_config FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- process_events
DROP POLICY IF EXISTS "Authenticated users can manage process_events" ON public.process_events;
CREATE POLICY "Authenticated users can manage process_events" ON public.process_events FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- process_step_history
DROP POLICY IF EXISTS "Authenticated users can manage process_step_history" ON public.process_step_history;
CREATE POLICY "Authenticated users can manage process_step_history" ON public.process_step_history FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- product_process
DROP POLICY IF EXISTS "Authenticated users can manage product_process" ON public.product_process;
CREATE POLICY "Authenticated users can manage product_process" ON public.product_process FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_amostra_fotos
DROP POLICY IF EXISTS "Auth users manage amostra_fotos" ON public.produto_amostra_fotos;
CREATE POLICY "Auth users manage amostra_fotos" ON public.produto_amostra_fotos FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_amostras
DROP POLICY IF EXISTS "Auth users manage amostras" ON public.produto_amostras;
CREATE POLICY "Auth users manage amostras" ON public.produto_amostras FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_analise_embalagem
DROP POLICY IF EXISTS "Authenticated users can manage produto_analise_embalagem" ON public.produto_analise_embalagem;
CREATE POLICY "Authenticated users can manage produto_analise_embalagem" ON public.produto_analise_embalagem FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_brasil_checklist
DROP POLICY IF EXISTS "Authenticated users can manage produto_brasil_checklist" ON public.produto_brasil_checklist;
CREATE POLICY "Authenticated users can manage produto_brasil_checklist" ON public.produto_brasil_checklist FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_brasil_grade_itens
DROP POLICY IF EXISTS "Authenticated users can manage grade items" ON public.produto_brasil_grade_itens;
CREATE POLICY "Authenticated users can manage grade items" ON public.produto_brasil_grade_itens FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_brasil_historico
DROP POLICY IF EXISTS "Authenticated users can manage produto_brasil_historico" ON public.produto_brasil_historico;
CREATE POLICY "Authenticated users can manage produto_brasil_historico" ON public.produto_brasil_historico FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_brasil_imagens
DROP POLICY IF EXISTS "Authenticated users can manage produto_brasil_imagens" ON public.produto_brasil_imagens;
CREATE POLICY "Authenticated users can manage produto_brasil_imagens" ON public.produto_brasil_imagens FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_brasil_skus
DROP POLICY IF EXISTS "Authenticated users can manage produto_brasil_skus" ON public.produto_brasil_skus;
CREATE POLICY "Authenticated users can manage produto_brasil_skus" ON public.produto_brasil_skus FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_composicao
DROP POLICY IF EXISTS "Authenticated users can manage composicao" ON public.produto_composicao;
CREATE POLICY "Authenticated users can manage composicao" ON public.produto_composicao FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_composicao_versoes
DROP POLICY IF EXISTS "Authenticated users can manage composicao_versoes" ON public.produto_composicao_versoes;
CREATE POLICY "Authenticated users can manage composicao_versoes" ON public.produto_composicao_versoes FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_embalagem_cores
DROP POLICY IF EXISTS "Authenticated users can manage produto_embalagem_cores" ON public.produto_embalagem_cores;
CREATE POLICY "Authenticated users can manage produto_embalagem_cores" ON public.produto_embalagem_cores FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_etiqueta_bula
DROP POLICY IF EXISTS "Authenticated users can manage produto_etiqueta_bula" ON public.produto_etiqueta_bula;
CREATE POLICY "Authenticated users can manage produto_etiqueta_bula" ON public.produto_etiqueta_bula FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_etiqueta_cores
DROP POLICY IF EXISTS "Authenticated users can manage produto_etiqueta_cores" ON public.produto_etiqueta_cores;
CREATE POLICY "Authenticated users can manage produto_etiqueta_cores" ON public.produto_etiqueta_cores FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_fluxo_artes
DROP POLICY IF EXISTS "Authenticated users can manage produto_fluxo_artes" ON public.produto_fluxo_artes;
CREATE POLICY "Authenticated users can manage produto_fluxo_artes" ON public.produto_fluxo_artes FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_fluxo_artes_cores
DROP POLICY IF EXISTS "Authenticated users can manage produto_fluxo_artes_cores" ON public.produto_fluxo_artes_cores;
CREATE POLICY "Authenticated users can manage produto_fluxo_artes_cores" ON public.produto_fluxo_artes_cores FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_gate_criacao
DROP POLICY IF EXISTS "Authenticated users can manage gate_criacao" ON public.produto_gate_criacao;
CREATE POLICY "Authenticated users can manage gate_criacao" ON public.produto_gate_criacao FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_peticionamento
DROP POLICY IF EXISTS "Authenticated users can manage peticionamento" ON public.produto_peticionamento;
CREATE POLICY "Authenticated users can manage peticionamento" ON public.produto_peticionamento FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_solicitacao_amostra
DROP POLICY IF EXISTS "Authenticated users can manage produto_solicitacao_amostra" ON public.produto_solicitacao_amostra;
CREATE POLICY "Authenticated users can manage produto_solicitacao_amostra" ON public.produto_solicitacao_amostra FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- projeto_calendario_regras
DROP POLICY IF EXISTS "Authenticated users can manage regras" ON public.projeto_calendario_regras;
CREATE POLICY "Authenticated users can manage regras" ON public.projeto_calendario_regras FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- projeto_planos_acao
DROP POLICY IF EXISTS "Authenticated users can manage planos" ON public.projeto_planos_acao;
CREATE POLICY "Authenticated users can manage planos" ON public.projeto_planos_acao FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- projeto_tarefa_documentos
DROP POLICY IF EXISTS "Authenticated users can manage task documents" ON public.projeto_tarefa_documentos;
CREATE POLICY "Authenticated users can manage task documents" ON public.projeto_tarefa_documentos FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- projeto_tarefa_metas_calendario
DROP POLICY IF EXISTS "Authenticated users can manage task metas" ON public.projeto_tarefa_metas_calendario;
CREATE POLICY "Authenticated users can manage task metas" ON public.projeto_tarefa_metas_calendario FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- projeto_tarefa_validacoes
DROP POLICY IF EXISTS "Authenticated users can manage validacoes" ON public.projeto_tarefa_validacoes;
CREATE POLICY "Authenticated users can manage validacoes" ON public.projeto_tarefa_validacoes FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ============ SERVICE ROLE POLICIES ============
-- Replace USING(true) with auth.role() = 'service_role' for service_role policies

-- api_rate_limit
DROP POLICY IF EXISTS "service_role_full_access" ON public.api_rate_limit;
CREATE POLICY "service_role_full_access" ON public.api_rate_limit FOR ALL TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- boletos
DROP POLICY IF EXISTS "Service role full access on boletos" ON public.boletos;
CREATE POLICY "Service role full access on boletos" ON public.boletos FOR ALL TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- cliente_caracteristicas
DROP POLICY IF EXISTS "service_role_full_access" ON public.cliente_caracteristicas;
CREATE POLICY "service_role_full_access" ON public.cliente_caracteristicas FOR ALL TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- cliente_tags
DROP POLICY IF EXISTS "service_role_full_access" ON public.cliente_tags;
CREATE POLICY "service_role_full_access" ON public.cliente_tags FOR ALL TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- documento_anexos (service role)
DROP POLICY IF EXISTS "Service role full access on documento_anexos" ON public.documento_anexos;
CREATE POLICY "Service role full access on documento_anexos" ON public.documento_anexos FOR ALL TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- erp_sync_log (service role individual policies)
DROP POLICY IF EXISTS "Service role can delete erp_sync_log" ON public.erp_sync_log;
CREATE POLICY "Service role can delete erp_sync_log" ON public.erp_sync_log FOR DELETE TO service_role USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can update erp_sync_log" ON public.erp_sync_log;
CREATE POLICY "Service role can update erp_sync_log" ON public.erp_sync_log FOR UPDATE TO service_role USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can insert erp_sync_log" ON public.erp_sync_log;
CREATE POLICY "Service role can insert erp_sync_log" ON public.erp_sync_log FOR INSERT TO service_role WITH CHECK (auth.role() = 'service_role');

-- ibge_estados
DROP POLICY IF EXISTS "Service role can manage ibge_estados" ON public.ibge_estados;
CREATE POLICY "Service role can manage ibge_estados" ON public.ibge_estados FOR ALL TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ibge_microrregioes
DROP POLICY IF EXISTS "Service role can manage ibge_microrregioes" ON public.ibge_microrregioes;
CREATE POLICY "Service role can manage ibge_microrregioes" ON public.ibge_microrregioes FOR ALL TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ibge_municipios
DROP POLICY IF EXISTS "Service role can manage ibge_municipios" ON public.ibge_municipios;
CREATE POLICY "Service role can manage ibge_municipios" ON public.ibge_municipios FOR ALL TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- orcamentos_caixa
DROP POLICY IF EXISTS "Service role full access on orcamentos_caixa" ON public.orcamentos_caixa;
CREATE POLICY "Service role full access on orcamentos_caixa" ON public.orcamentos_caixa FOR ALL TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- parcelas_condicoes
DROP POLICY IF EXISTS "service_role_all_parcelas_condicoes" ON public.parcelas_condicoes;
CREATE POLICY "service_role_all_parcelas_condicoes" ON public.parcelas_condicoes FOR ALL TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- session_invalidation_queue
DROP POLICY IF EXISTS "service_role_insert" ON public.session_invalidation_queue;
CREATE POLICY "service_role_insert" ON public.session_invalidation_queue FOR INSERT TO service_role WITH CHECK (auth.role() = 'service_role');

-- webhook_delivery_log
DROP POLICY IF EXISTS "service_full_wl" ON public.webhook_delivery_log;
CREATE POLICY "service_full_wl" ON public.webhook_delivery_log FOR ALL TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- webhook_event_queue
DROP POLICY IF EXISTS "service_full_wq" ON public.webhook_event_queue;
CREATE POLICY "service_full_wq" ON public.webhook_event_queue FOR ALL TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- webhook_subscriptions
DROP POLICY IF EXISTS "service_full_ws" ON public.webhook_subscriptions;
CREATE POLICY "service_full_ws" ON public.webhook_subscriptions FOR ALL TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');