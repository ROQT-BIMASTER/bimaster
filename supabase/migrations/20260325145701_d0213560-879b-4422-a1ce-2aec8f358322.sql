
-- =============================================
-- BATCH 1: Financial & ERP tables
-- =============================================

-- boletos
DROP POLICY IF EXISTS "Authenticated users can insert boletos" ON public.boletos;
CREATE POLICY "Authenticated users can insert boletos" ON public.boletos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update boletos" ON public.boletos;
CREATE POLICY "Authenticated users can update boletos" ON public.boletos
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- erp_sync_log
DROP POLICY IF EXISTS "Authenticated users can insert erp_sync_log" ON public.erp_sync_log;
CREATE POLICY "Authenticated users can insert erp_sync_log" ON public.erp_sync_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "erp_sync_log_insert_authenticated" ON public.erp_sync_log;
CREATE POLICY "erp_sync_log_insert_authenticated" ON public.erp_sync_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Service role can insert erp_sync_log" ON public.erp_sync_log;
CREATE POLICY "Service role can insert erp_sync_log" ON public.erp_sync_log
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update erp_sync_log" ON public.erp_sync_log;
CREATE POLICY "Service role can update erp_sync_log" ON public.erp_sync_log
  FOR UPDATE TO service_role USING (true);

DROP POLICY IF EXISTS "Service role can delete erp_sync_log" ON public.erp_sync_log;
CREATE POLICY "Service role can delete erp_sync_log" ON public.erp_sync_log
  FOR DELETE TO service_role USING (true);

-- =============================================
-- BATCH 2: Process & Document tables
-- =============================================

-- process_juntadas
DROP POLICY IF EXISTS "Authenticated users can insert process_juntadas" ON public.process_juntadas;
CREATE POLICY "Authenticated users can insert process_juntadas" ON public.process_juntadas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update process_juntadas" ON public.process_juntadas;
CREATE POLICY "Authenticated users can update process_juntadas" ON public.process_juntadas
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- process_tipos_documento
DROP POLICY IF EXISTS "Authenticated users can insert process_tipos_documento" ON public.process_tipos_documento;
CREATE POLICY "Authenticated users can insert process_tipos_documento" ON public.process_tipos_documento
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update process_tipos_documento" ON public.process_tipos_documento;
CREATE POLICY "Authenticated users can update process_tipos_documento" ON public.process_tipos_documento
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- process_doc_workflow_transicoes
DROP POLICY IF EXISTS "Authenticated users can insert process_doc_workflow_transicoes" ON public.process_doc_workflow_transicoes;
CREATE POLICY "Authenticated users can insert process_doc_workflow_transicoes" ON public.process_doc_workflow_transicoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- BATCH 3: Product tables
-- =============================================

-- produtos_brasil
DROP POLICY IF EXISTS "Authenticated users can insert produtos_brasil" ON public.produtos_brasil;
CREATE POLICY "Authenticated users can insert produtos_brasil" ON public.produtos_brasil
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update produtos_brasil" ON public.produtos_brasil;
CREATE POLICY "Authenticated users can update produtos_brasil" ON public.produtos_brasil
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produtos_brasil_custos
DROP POLICY IF EXISTS "Authenticated users can insert produtos_brasil_custos" ON public.produtos_brasil_custos;
CREATE POLICY "Authenticated users can insert produtos_brasil_custos" ON public.produtos_brasil_custos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update produtos_brasil_custos" ON public.produtos_brasil_custos;
CREATE POLICY "Authenticated users can update produtos_brasil_custos" ON public.produtos_brasil_custos
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete produtos_brasil_custos" ON public.produtos_brasil_custos;
CREATE POLICY "Authenticated users can delete produtos_brasil_custos" ON public.produtos_brasil_custos
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- produtos_brasil_precos
DROP POLICY IF EXISTS "Authenticated users can insert produtos_brasil_precos" ON public.produtos_brasil_precos;
CREATE POLICY "Authenticated users can insert produtos_brasil_precos" ON public.produtos_brasil_precos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update produtos_brasil_precos" ON public.produtos_brasil_precos;
CREATE POLICY "Authenticated users can update produtos_brasil_precos" ON public.produtos_brasil_precos
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete produtos_brasil_precos" ON public.produtos_brasil_precos;
CREATE POLICY "Authenticated users can delete produtos_brasil_precos" ON public.produtos_brasil_precos
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- produto_aprovacoes_fisicas
DROP POLICY IF EXISTS "Authenticated users can insert produto_aprovacoes_fisicas" ON public.produto_aprovacoes_fisicas;
CREATE POLICY "Authenticated users can insert produto_aprovacoes_fisicas" ON public.produto_aprovacoes_fisicas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update produto_aprovacoes_fisicas" ON public.produto_aprovacoes_fisicas;
CREATE POLICY "Authenticated users can update produto_aprovacoes_fisicas" ON public.produto_aprovacoes_fisicas
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_rnc
DROP POLICY IF EXISTS "Authenticated users can insert produto_rnc" ON public.produto_rnc;
CREATE POLICY "Authenticated users can insert produto_rnc" ON public.produto_rnc
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update produto_rnc" ON public.produto_rnc;
CREATE POLICY "Authenticated users can update produto_rnc" ON public.produto_rnc
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- produto_testes
DROP POLICY IF EXISTS "Authenticated users can insert produto_testes" ON public.produto_testes;
CREATE POLICY "Authenticated users can insert produto_testes" ON public.produto_testes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update produto_testes" ON public.produto_testes;
CREATE POLICY "Authenticated users can update produto_testes" ON public.produto_testes
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete produto_testes" ON public.produto_testes;
CREATE POLICY "Authenticated users can delete produto_testes" ON public.produto_testes
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- produto_brasil_pasta_digital
DROP POLICY IF EXISTS "Authenticated users can insert produto_brasil_pasta_digital" ON public.produto_brasil_pasta_digital;
CREATE POLICY "Authenticated users can insert produto_brasil_pasta_digital" ON public.produto_brasil_pasta_digital
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update produto_brasil_pasta_digital" ON public.produto_brasil_pasta_digital;
CREATE POLICY "Authenticated users can update produto_brasil_pasta_digital" ON public.produto_brasil_pasta_digital
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete produto_brasil_pasta_digital" ON public.produto_brasil_pasta_digital;
CREATE POLICY "Authenticated users can delete produto_brasil_pasta_digital" ON public.produto_brasil_pasta_digital
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- =============================================
-- BATCH 4: Project tables
-- =============================================

-- projetos
DROP POLICY IF EXISTS "Authenticated users can insert projetos" ON public.projetos;
CREATE POLICY "Authenticated users can insert projetos" ON public.projetos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- projeto_tarefas
DROP POLICY IF EXISTS "Authenticated users can insert projeto_tarefas" ON public.projeto_tarefas;
CREATE POLICY "Authenticated users can insert projeto_tarefas" ON public.projeto_tarefas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update projeto_tarefas" ON public.projeto_tarefas;
CREATE POLICY "Authenticated users can update projeto_tarefas" ON public.projeto_tarefas
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete projeto_tarefas" ON public.projeto_tarefas;
CREATE POLICY "Authenticated users can delete projeto_tarefas" ON public.projeto_tarefas
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- projeto_secoes
DROP POLICY IF EXISTS "Authenticated users can insert projeto_secoes" ON public.projeto_secoes;
CREATE POLICY "Authenticated users can insert projeto_secoes" ON public.projeto_secoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update projeto_secoes" ON public.projeto_secoes;
CREATE POLICY "Authenticated users can update projeto_secoes" ON public.projeto_secoes
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete projeto_secoes" ON public.projeto_secoes;
CREATE POLICY "Authenticated users can delete projeto_secoes" ON public.projeto_secoes
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- projeto_atividades
DROP POLICY IF EXISTS "Authenticated users can insert projeto_atividades" ON public.projeto_atividades;
CREATE POLICY "Authenticated users can insert projeto_atividades" ON public.projeto_atividades
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update projeto_atividades" ON public.projeto_atividades;
CREATE POLICY "Authenticated users can update projeto_atividades" ON public.projeto_atividades
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- projeto_briefings
DROP POLICY IF EXISTS "Authenticated users can insert projeto_briefings" ON public.projeto_briefings;
CREATE POLICY "Authenticated users can insert projeto_briefings" ON public.projeto_briefings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- projeto_tarefa_colaboradores
DROP POLICY IF EXISTS "Authenticated users can insert projeto_tarefa_colaboradores" ON public.projeto_tarefa_colaboradores;
CREATE POLICY "Authenticated users can insert projeto_tarefa_colaboradores" ON public.projeto_tarefa_colaboradores
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete projeto_tarefa_colaboradores" ON public.projeto_tarefa_colaboradores;
CREATE POLICY "Authenticated users can delete projeto_tarefa_colaboradores" ON public.projeto_tarefa_colaboradores
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- projeto_tarefa_metas
DROP POLICY IF EXISTS "Authenticated users can insert projeto_tarefa_metas" ON public.projeto_tarefa_metas;
CREATE POLICY "Authenticated users can insert projeto_tarefa_metas" ON public.projeto_tarefa_metas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update projeto_tarefa_metas" ON public.projeto_tarefa_metas;
CREATE POLICY "Authenticated users can update projeto_tarefa_metas" ON public.projeto_tarefa_metas
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete projeto_tarefa_metas" ON public.projeto_tarefa_metas;
CREATE POLICY "Authenticated users can delete projeto_tarefa_metas" ON public.projeto_tarefa_metas
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- projeto_tarefa_produtos
DROP POLICY IF EXISTS "Authenticated users can insert projeto_tarefa_produtos" ON public.projeto_tarefa_produtos;
CREATE POLICY "Authenticated users can insert projeto_tarefa_produtos" ON public.projeto_tarefa_produtos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete projeto_tarefa_produtos" ON public.projeto_tarefa_produtos;
CREATE POLICY "Authenticated users can delete projeto_tarefa_produtos" ON public.projeto_tarefa_produtos
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- projeto_tarefa_movimentacoes
DROP POLICY IF EXISTS "Authenticated users can insert projeto_tarefa_movimentacoes" ON public.projeto_tarefa_movimentacoes;
CREATE POLICY "Authenticated users can insert projeto_tarefa_movimentacoes" ON public.projeto_tarefa_movimentacoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- BATCH 5: China / Supply Chain tables
-- =============================================

-- china_categoria_responsaveis
DROP POLICY IF EXISTS "Authenticated users can insert china_categoria_responsaveis" ON public.china_categoria_responsaveis;
CREATE POLICY "Authenticated users can insert china_categoria_responsaveis" ON public.china_categoria_responsaveis
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update china_categoria_responsaveis" ON public.china_categoria_responsaveis;
CREATE POLICY "Authenticated users can update china_categoria_responsaveis" ON public.china_categoria_responsaveis
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete china_categoria_responsaveis" ON public.china_categoria_responsaveis;
CREATE POLICY "Authenticated users can delete china_categoria_responsaveis" ON public.china_categoria_responsaveis
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- china_embarques
DROP POLICY IF EXISTS "Authenticated users can insert embarques" ON public.china_embarques;
CREATE POLICY "Authenticated users can insert embarques" ON public.china_embarques
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update embarques" ON public.china_embarques;
CREATE POLICY "Authenticated users can update embarques" ON public.china_embarques
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- china_ficha_despachos
DROP POLICY IF EXISTS "Authenticated users can insert despachos" ON public.china_ficha_despachos;
CREATE POLICY "Authenticated users can insert despachos" ON public.china_ficha_despachos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- china_ficha_visibilidade
DROP POLICY IF EXISTS "Authenticated users can insert visibility records" ON public.china_ficha_visibilidade;
CREATE POLICY "Authenticated users can insert visibility records" ON public.china_ficha_visibilidade
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete visibility records" ON public.china_ficha_visibilidade;
CREATE POLICY "Authenticated users can delete visibility records" ON public.china_ficha_visibilidade
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- china_ordens_compra
DROP POLICY IF EXISTS "Authenticated users can insert china_ordens_compra" ON public.china_ordens_compra;
CREATE POLICY "Authenticated users can insert china_ordens_compra" ON public.china_ordens_compra
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update china_ordens_compra" ON public.china_ordens_compra;
CREATE POLICY "Authenticated users can update china_ordens_compra" ON public.china_ordens_compra
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- china_pasta_digital
DROP POLICY IF EXISTS "Authenticated users can insert china_pasta_digital" ON public.china_pasta_digital;
CREATE POLICY "Authenticated users can insert china_pasta_digital" ON public.china_pasta_digital
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update china_pasta_digital" ON public.china_pasta_digital;
CREATE POLICY "Authenticated users can update china_pasta_digital" ON public.china_pasta_digital
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete china_pasta_digital" ON public.china_pasta_digital;
CREATE POLICY "Authenticated users can delete china_pasta_digital" ON public.china_pasta_digital
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- china_producao_apontamentos
DROP POLICY IF EXISTS "Authenticated users can insert china_producao_apontamentos" ON public.china_producao_apontamentos;
CREATE POLICY "Authenticated users can insert china_producao_apontamentos" ON public.china_producao_apontamentos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- BATCH 6: Remaining tables
-- =============================================

-- ap_data_source_config
DROP POLICY IF EXISTS "Authenticated users can insert ap_data_source_config" ON public.ap_data_source_config;
CREATE POLICY "Authenticated users can insert ap_data_source_config" ON public.ap_data_source_config
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update ap_data_source_config" ON public.ap_data_source_config;
CREATE POLICY "Authenticated users can update ap_data_source_config" ON public.ap_data_source_config
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- api_support_messages
DROP POLICY IF EXISTS "admin_update" ON public.api_support_messages;
CREATE POLICY "admin_update" ON public.api_support_messages
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- cnaes
DROP POLICY IF EXISTS "authenticated_insert_cnaes" ON public.cnaes;
CREATE POLICY "authenticated_insert_cnaes" ON public.cnaes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- cofre_produto_itens
DROP POLICY IF EXISTS "Authenticated can insert cofre itens" ON public.cofre_produto_itens;
CREATE POLICY "Authenticated can insert cofre itens" ON public.cofre_produto_itens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can update cofre itens" ON public.cofre_produto_itens;
CREATE POLICY "Authenticated can update cofre itens" ON public.cofre_produto_itens
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

-- departamento_visibilidade_audit
DROP POLICY IF EXISTS "authenticated_insert_audit" ON public.departamento_visibilidade_audit;
CREATE POLICY "authenticated_insert_audit" ON public.departamento_visibilidade_audit
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- fabrica_itens_nf_saida
DROP POLICY IF EXISTS "Authenticated users can insert itens NF saida" ON public.fabrica_itens_nf_saida;
CREATE POLICY "Authenticated users can insert itens NF saida" ON public.fabrica_itens_nf_saida
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update itens NF saida" ON public.fabrica_itens_nf_saida;
CREATE POLICY "Authenticated users can update itens NF saida" ON public.fabrica_itens_nf_saida
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete itens NF saida" ON public.fabrica_itens_nf_saida;
CREATE POLICY "Authenticated users can delete itens NF saida" ON public.fabrica_itens_nf_saida
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- fabrica_notas_fiscais_saida
DROP POLICY IF EXISTS "Authenticated users can insert NF saida" ON public.fabrica_notas_fiscais_saida;
CREATE POLICY "Authenticated users can insert NF saida" ON public.fabrica_notas_fiscais_saida
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update NF saida" ON public.fabrica_notas_fiscais_saida;
CREATE POLICY "Authenticated users can update NF saida" ON public.fabrica_notas_fiscais_saida
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete NF saida" ON public.fabrica_notas_fiscais_saida;
CREATE POLICY "Authenticated users can delete NF saida" ON public.fabrica_notas_fiscais_saida
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- fabrica_produtos_historico
DROP POLICY IF EXISTS "Authenticated users can insert fabrica_produtos_historico" ON public.fabrica_produtos_historico;
CREATE POLICY "Authenticated users can insert fabrica_produtos_historico" ON public.fabrica_produtos_historico
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- fabrica_tax_rates_iva
DROP POLICY IF EXISTS "Authenticated users can insert fabrica_tax_rates_iva" ON public.fabrica_tax_rates_iva;
CREATE POLICY "Authenticated users can insert fabrica_tax_rates_iva" ON public.fabrica_tax_rates_iva
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update fabrica_tax_rates_iva" ON public.fabrica_tax_rates_iva;
CREATE POLICY "Authenticated users can update fabrica_tax_rates_iva" ON public.fabrica_tax_rates_iva
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete fabrica_tax_rates_iva" ON public.fabrica_tax_rates_iva;
CREATE POLICY "Authenticated users can delete fabrica_tax_rates_iva" ON public.fabrica_tax_rates_iva
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- financial_payment_queue_history
DROP POLICY IF EXISTS "Authenticated users can insert financial_payment_queue_history" ON public.financial_payment_queue_history;
CREATE POLICY "Authenticated users can insert financial_payment_queue_history" ON public.financial_payment_queue_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- fluxo_aprovacao_anexos
DROP POLICY IF EXISTS "Authenticated users can insert fluxo_aprovacao_anexos" ON public.fluxo_aprovacao_anexos;
CREATE POLICY "Authenticated users can insert fluxo_aprovacao_anexos" ON public.fluxo_aprovacao_anexos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete fluxo_aprovacao_anexos" ON public.fluxo_aprovacao_anexos;
CREATE POLICY "Authenticated users can delete fluxo_aprovacao_anexos" ON public.fluxo_aprovacao_anexos
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- fluxo_aprovacao_aprovadores
DROP POLICY IF EXISTS "Authenticated users can update fluxo_aprovacao_aprovadores" ON public.fluxo_aprovacao_aprovadores;
CREATE POLICY "Authenticated users can update fluxo_aprovacao_aprovadores" ON public.fluxo_aprovacao_aprovadores
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- fluxo_aprovacao_instancias
DROP POLICY IF EXISTS "Authenticated users can insert fluxo_aprovacao_instancias" ON public.fluxo_aprovacao_instancias;
CREATE POLICY "Authenticated users can insert fluxo_aprovacao_instancias" ON public.fluxo_aprovacao_instancias
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update fluxo_aprovacao_instancias" ON public.fluxo_aprovacao_instancias;
CREATE POLICY "Authenticated users can update fluxo_aprovacao_instancias" ON public.fluxo_aprovacao_instancias
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- fluxo_aprovacao_transicoes
DROP POLICY IF EXISTS "Authenticated users can insert fluxo_aprovacao_transicoes" ON public.fluxo_aprovacao_transicoes;
CREATE POLICY "Authenticated users can insert fluxo_aprovacao_transicoes" ON public.fluxo_aprovacao_transicoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- fluxo_aprovacao_vinculos
DROP POLICY IF EXISTS "Authenticated users can insert fluxo_aprovacao_vinculos" ON public.fluxo_aprovacao_vinculos;
CREATE POLICY "Authenticated users can insert fluxo_aprovacao_vinculos" ON public.fluxo_aprovacao_vinculos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete fluxo_aprovacao_vinculos" ON public.fluxo_aprovacao_vinculos;
CREATE POLICY "Authenticated users can delete fluxo_aprovacao_vinculos" ON public.fluxo_aprovacao_vinculos
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- meeting tables
DROP POLICY IF EXISTS "Authenticated users can insert meeting_insights" ON public.meeting_insights;
CREATE POLICY "Authenticated users can insert meeting_insights" ON public.meeting_insights
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert meeting_risks" ON public.meeting_risks;
CREATE POLICY "Authenticated users can insert meeting_risks" ON public.meeting_risks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert meeting_tasks" ON public.meeting_tasks;
CREATE POLICY "Authenticated users can insert meeting_tasks" ON public.meeting_tasks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- notificacoes
DROP POLICY IF EXISTS "Authenticated users can insert notificacoes" ON public.notificacoes;
CREATE POLICY "Authenticated users can insert notificacoes" ON public.notificacoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- paises
DROP POLICY IF EXISTS "Authenticated users can insert paises" ON public.paises;
CREATE POLICY "Authenticated users can insert paises" ON public.paises
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- parcelas_condicoes
DROP POLICY IF EXISTS "Authenticated users can insert parcelas_condicoes" ON public.parcelas_condicoes;
CREATE POLICY "Authenticated users can insert parcelas_condicoes" ON public.parcelas_condicoes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- session_invalidation_queue
DROP POLICY IF EXISTS "Authenticated users can insert session_invalidation_queue" ON public.session_invalidation_queue;
CREATE POLICY "Authenticated users can insert session_invalidation_queue" ON public.session_invalidation_queue
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- tipos_anexo
DROP POLICY IF EXISTS "Authenticated users can insert tipos_anexo" ON public.tipos_anexo;
CREATE POLICY "Authenticated users can insert tipos_anexo" ON public.tipos_anexo
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- tipos_atividade_empresa
DROP POLICY IF EXISTS "Authenticated users can insert tipos_atividade_empresa" ON public.tipos_atividade_empresa;
CREATE POLICY "Authenticated users can insert tipos_atividade_empresa" ON public.tipos_atividade_empresa
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- tipos_entrega
DROP POLICY IF EXISTS "Authenticated users can insert tipos_entrega" ON public.tipos_entrega;
CREATE POLICY "Authenticated users can insert tipos_entrega" ON public.tipos_entrega
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update tipos_entrega" ON public.tipos_entrega;
CREATE POLICY "Authenticated users can update tipos_entrega" ON public.tipos_entrega
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete tipos_entrega" ON public.tipos_entrega;
CREATE POLICY "Authenticated users can delete tipos_entrega" ON public.tipos_entrega
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- ui_permissions_audit
DROP POLICY IF EXISTS "Authenticated users can insert ui_permissions_audit" ON public.ui_permissions_audit;
CREATE POLICY "Authenticated users can insert ui_permissions_audit" ON public.ui_permissions_audit
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
