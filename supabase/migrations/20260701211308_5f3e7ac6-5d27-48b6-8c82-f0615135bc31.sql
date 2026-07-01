-- Unify duplicate "$" categories and add a hidden "Em Desenvolvimento" module
-- to host orphan/unlinked pages so nothing is lost from the app.

-- 1) Move "precos" module into "financeiro_admin" and hide the duplicate category.
DO $mig$
DECLARE
  v_fin_id uuid;
  v_precos_cat_id uuid;
BEGIN
  SELECT id INTO v_fin_id FROM public.sidebar_categories WHERE key='financeiro_admin';
  SELECT id INTO v_precos_cat_id FROM public.sidebar_categories WHERE key='precos';

  IF v_fin_id IS NOT NULL AND v_precos_cat_id IS NOT NULL THEN
    -- move any modules attached to precos into financeiro_admin (dedupe by module_code)
    INSERT INTO public.sidebar_category_modules (category_id, module_code, label_override, icon_override, ordem, ativo)
    SELECT v_fin_id, cm.module_code, COALESCE(cm.label_override,'Tabelas de Preço'), COALESCE(cm.icon_override,'DollarSign'), 20, true
    FROM public.sidebar_category_modules cm
    WHERE cm.category_id = v_precos_cat_id
    ON CONFLICT DO NOTHING;

    -- Deactivate the duplicate category and its old links so v2 stops showing "$" twice.
    UPDATE public.sidebar_category_modules SET ativo=false WHERE category_id=v_precos_cat_id;
    UPDATE public.sidebar_categories SET ativo=false WHERE id=v_precos_cat_id;
  END IF;
END $mig$;

-- 2) Register the "em_desenvolvimento" module in modulos_sistema (admin-only).
INSERT INTO public.modulos_sistema (codigo, nome, descricao, icone, ordem, ativo, acesso_padrao)
VALUES ('em_desenvolvimento','Em Desenvolvimento','Telas ainda não vinculadas ao menu oficial — visíveis somente para administradores.','FlaskConical', 9999, true, false)
ON CONFLICT (codigo) DO UPDATE SET
  nome=EXCLUDED.nome, descricao=EXCLUDED.descricao, icone=EXCLUDED.icone, ativo=true;

-- 3) Create the "em_desenvolvimento" sidebar category and link the module.
INSERT INTO public.sidebar_categories (key, label, icon, ordem, ativo)
VALUES ('em_desenvolvimento','Em Desenvolvimento','FlaskConical', 990, true)
ON CONFLICT (key) DO UPDATE SET label=EXCLUDED.label, icon=EXCLUDED.icon, ativo=true;

INSERT INTO public.sidebar_category_modules (category_id, module_code, label_override, icon_override, ordem, ativo)
SELECT c.id, 'em_desenvolvimento', 'Telas em Desenvolvimento', 'FlaskConical', 1, true
FROM public.sidebar_categories c WHERE c.key='em_desenvolvimento'
ON CONFLICT DO NOTHING;

-- 4) Bulk insert orphan routes as menu items under the new module,
--    grouped by parent_group. All require admin so the module stays hidden
--    from regular users.
INSERT INTO public.sidebar_menu_items
  (module_code, item_code, label, route, parent_group, ordem, ativo, require_admin)
VALUES
('em_desenvolvimento','admin_cofre_templates','Admin / Cofre Templates','/admin/cofre-templates','Admin/Governança',10, true),
  ('em_desenvolvimento','admin_documentacao_tecnica','Admin / Documentacao Tecnica','/admin/documentacao-tecnica','Admin/Governança',20, true),
  ('em_desenvolvimento','admin_suporte','Admin / Suporte','/admin/suporte','Admin/Governança',30, true),
  ('em_desenvolvimento','admin_templates_alcadas','Admin / Templates Alcadas','/admin/templates-alcadas','Admin/Governança',40, true),
  ('em_desenvolvimento','admin_uploads_rejeitados','Admin / Uploads Rejeitados','/admin/uploads-rejeitados','Admin/Governança',50, true),
  ('em_desenvolvimento','admin_versoes_clientes','Admin / Versoes Clientes','/admin/versoes-clientes','Admin/Governança',60, true),
  ('em_desenvolvimento','dashboard_admin_api_support','Dashboard / Admin API Support','/dashboard/admin-api-support','Admin/Governança',70, true),
  ('em_desenvolvimento','dashboard_admin_alertas_backfill_tarefas','Admin / Alertas Backfill Tarefas','/dashboard/admin/alertas-backfill-tarefas','Admin/Governança',80, true),
  ('em_desenvolvimento','dashboard_admin_checagem_semanal_tarefas','Admin / Checagem Semanal Tarefas','/dashboard/admin/checagem-semanal-tarefas','Admin/Governança',90, true),
  ('em_desenvolvimento','dashboard_admin_dedupe_perfis','Admin / Dedupe Perfis','/dashboard/admin/dedupe-perfis','Admin/Governança',100, true),
  ('em_desenvolvimento','dashboard_admin_diagnostico_tarefas_data_conclusao','Admin / Diagnostico Tarefas Data Conclusao','/dashboard/admin/diagnostico-tarefas-data-conclusao','Admin/Governança',110, true),
  ('em_desenvolvimento','dashboard_admin_historico_backfill_tarefas','Admin / Historico Backfill Tarefas','/dashboard/admin/historico-backfill-tarefas','Admin/Governança',120, true),
  ('em_desenvolvimento','dashboard_admin_relatorios_v2','Admin / Relatorios V2','/dashboard/admin/relatorios-v2','Admin/Governança',130, true),
  ('em_desenvolvimento','dashboard_admin_relatorios_v2_novo','Relatorios V2 / Novo','/dashboard/admin/relatorios-v2/novo','Admin/Governança',140, true),
  ('em_desenvolvimento','dashboard_admin_visibilidade_detalhe_tarefa','Admin / Visibilidade Detalhe Tarefa','/dashboard/admin/visibilidade-detalhe-tarefa','Admin/Governança',150, true),
  ('em_desenvolvimento','dashboard_chat','Dashboard / Chat','/dashboard/chat','Chat',160, true),
  ('em_desenvolvimento','dashboard_chat_aprovacoes','Chat / Aprovacoes','/dashboard/chat/aprovacoes','Chat',170, true),
  ('em_desenvolvimento','dashboard_compras_internacionais','Dashboard / Compras Internacionais','/dashboard/compras-internacionais','Comercial/Operação',180, true),
  ('em_desenvolvimento','dashboard_compras_internacionais_inbox','Compras Internacionais / Inbox','/dashboard/compras-internacionais/inbox','Comercial/Operação',190, true),
  ('em_desenvolvimento','dashboard_compras_nacionais','Dashboard / Compras Nacionais','/dashboard/compras-nacionais','Comercial/Operação',200, true),
  ('em_desenvolvimento','dashboard_configuracoes_fornecedores_visibilidade','Configuracoes / Fornecedores Visibilidade','/dashboard/configuracoes/fornecedores-visibilidade','Comercial/Operação',210, true),
  ('em_desenvolvimento','dashboard_estoque_fornecedor','Estoque / Fornecedor','/dashboard/estoque/fornecedor','Comercial/Operação',220, true),
  ('em_desenvolvimento','dashboard_estoque_fornecedor_depara','Estoque / Fornecedor Depara','/dashboard/estoque/fornecedor-depara','Comercial/Operação',230, true),
  ('em_desenvolvimento','dashboard_fornecedor','Dashboard / Fornecedor','/dashboard/fornecedor','Comercial/Operação',240, true),
  ('em_desenvolvimento','dashboard_fornecedor_analises','Fornecedor / Analises','/dashboard/fornecedor/analises','Comercial/Operação',250, true),
  ('em_desenvolvimento','dashboard_fornecedor_pedidos_result','Fornecedor / Pedidos Result','/dashboard/fornecedor/pedidos-result','Comercial/Operação',260, true),
  ('em_desenvolvimento','dashboard_importar_clientes','Dashboard / Importar Clientes','/dashboard/importar-clientes','Comercial/Operação',270, true),
  ('em_desenvolvimento','dashboard_oms','Dashboard / OMS','/dashboard/oms','Comercial/Operação',280, true),
  ('em_desenvolvimento','dashboard_oms_condicoes_pagamento','OMS / Condicoes Pagamento','/dashboard/oms/condicoes-pagamento','Comercial/Operação',290, true),
  ('em_desenvolvimento','dashboard_vendas_analise','Vendas / Analise','/dashboard/vendas/analise','Comercial/Operação',300, true),
  ('em_desenvolvimento','dashboard_configuracoes_api_health','Configuracoes / API Health','/dashboard/configuracoes/api-health','Configurações',310, true),
  ('em_desenvolvimento','dashboard_preferencias_ui','Dashboard / Preferencias Ui','/dashboard/preferencias-ui','Configurações',320, true),
  ('em_desenvolvimento','dashboard_bancos','Dashboard / Bancos','/dashboard/bancos','Financeiro',330, true),
  ('em_desenvolvimento','dashboard_contas_a_pagar','Dashboard / Contas A Pagar','/dashboard/contas-a-pagar','Financeiro',340, true),
  ('em_desenvolvimento','dashboard_contas_pagar','Dashboard / Contas Pagar','/dashboard/contas-pagar','Financeiro',350, true),
  ('em_desenvolvimento','dashboard_financeiro_contas_a_pagar_auditoria','Contas A Pagar / Auditoria','/dashboard/financeiro/contas-a-pagar/auditoria','Financeiro',360, true),
  ('em_desenvolvimento','dashboard_financeiro_contas_a_pagar_novo','Contas A Pagar / Novo','/dashboard/financeiro/contas-a-pagar/novo','Financeiro',370, true),
  ('em_desenvolvimento','dashboard_financeiro_contas_a_pagar_sync','Contas A Pagar / Sync','/dashboard/financeiro/contas-a-pagar/sync','Financeiro',380, true),
  ('em_desenvolvimento','dashboard_financeiro_contas_a_receber_auditoria','Contas A Receber / Auditoria','/dashboard/financeiro/contas-a-receber/auditoria','Financeiro',390, true),
  ('em_desenvolvimento','dashboard_financeiro_contas_a_receber_sync','Contas A Receber / Sync','/dashboard/financeiro/contas-a-receber/sync','Financeiro',400, true),
  ('em_desenvolvimento','dashboard_financeiro_fornecedores','Financeiro / Fornecedores','/dashboard/financeiro/fornecedores','Financeiro',410, true),
  ('em_desenvolvimento','dashboard_financeiro_trade','Financeiro / Trade','/dashboard/financeiro/trade','Financeiro',420, true),
  ('em_desenvolvimento','dashboard_financeiro_vendas_sync','Vendas / Sync','/dashboard/financeiro/vendas/sync','Financeiro',430, true),
  ('em_desenvolvimento','dashboard_pagamentos','Dashboard / Pagamentos','/dashboard/pagamentos','Financeiro',440, true),
  ('em_desenvolvimento','dashboard_plano_contas','Dashboard / Plano Contas','/dashboard/plano-contas','Financeiro',450, true),
  ('em_desenvolvimento','dashboard_trade_financeiro_dashboard','Financeiro / Dashboard','/dashboard/trade/financeiro/dashboard','Financeiro',460, true),
  ('em_desenvolvimento','dashboard_fabrica_analises_custos','Fabrica / Analises Custos','/dashboard/fabrica/analises-custos','Fábrica',470, true),
  ('em_desenvolvimento','dashboard_fabrica_auditoria_fotos','Fabrica / Auditoria Fotos','/dashboard/fabrica/auditoria-fotos','Fábrica',480, true),
  ('em_desenvolvimento','dashboard_fabrica_executivo','Fabrica / Executivo','/dashboard/fabrica/executivo','Fábrica',490, true),
  ('em_desenvolvimento','dashboard_fabrica_formulas_nova','Formulas / Nova','/dashboard/fabrica/formulas/nova','Fábrica',500, true),
  ('em_desenvolvimento','dashboard_fabrica_fornecedores','Fabrica / Fornecedores','/dashboard/fabrica/fornecedores','Fábrica',510, true),
  ('em_desenvolvimento','dashboard_fabrica_manual','Fabrica / Manual','/dashboard/fabrica/manual','Fábrica',520, true),
  ('em_desenvolvimento','dashboard_fabrica_produtos_importar','Produtos / Importar','/dashboard/fabrica/produtos/importar','Fábrica',530, true),
  ('em_desenvolvimento','dashboard_fabrica_china_auditoria_normalizacao','Fabrica China / Auditoria Normalizacao','/dashboard/fabrica-china/auditoria-normalizacao','Fábrica China',540, true),
  ('em_desenvolvimento','dashboard_fabrica_china_caixa_entrada','Fabrica China / Caixa Entrada','/dashboard/fabrica-china/caixa-entrada','Fábrica China',550, true),
  ('em_desenvolvimento','dashboard_fabrica_china_ordens_producao','Fabrica China / Ordens Producao','/dashboard/fabrica-china/ordens-producao','Fábrica China',560, true),
  ('em_desenvolvimento','dashboard_fabrica_china_patio_embarque','Fabrica China / Patio Embarque','/dashboard/fabrica-china/patio-embarque','Fábrica China',570, true),
  ('em_desenvolvimento','dashboard_fabrica_china_recebimentos_oc','Fabrica China / Recebimentos Oc','/dashboard/fabrica-china/recebimentos-oc','Fábrica China',580, true),
  ('em_desenvolvimento','dashboard_fabrica_china_recebimentos_divergencias','Recebimentos / Divergencias','/dashboard/fabrica-china/recebimentos/divergencias','Fábrica China',590, true),
  ('em_desenvolvimento','dashboard_fabrica_china_torre_containers','Fabrica China / Torre Containers','/dashboard/fabrica-china/torre-containers','Fábrica China',600, true),
  ('em_desenvolvimento','admin_integracoes_saude','Admin / Integracoes Saude','/admin/integracoes-saude','Integrações',610, true),
  ('em_desenvolvimento','admin_integracoes_google_drive','Integracoes / Google Drive','/admin/integracoes/google-drive','Integrações',620, true),
  ('em_desenvolvimento','dashboard_admin_asana_importacao','Admin / Asana Importacao','/dashboard/admin/asana-importacao','Integrações',630, true),
  ('em_desenvolvimento','dashboard_admin_asana_sync','Admin / Asana Sync','/dashboard/admin/asana-sync','Integrações',640, true),
  ('em_desenvolvimento','dashboard_integracoes_asana','Integracoes / Asana','/dashboard/integracoes/asana','Integrações',650, true),
  ('em_desenvolvimento','dashboard_integracoes_notion','Integracoes / Notion','/dashboard/integracoes/notion','Integrações',660, true),
  ('em_desenvolvimento','dashboard_integracoes_shipsgo','Integracoes / Shipsgo','/dashboard/integracoes/shipsgo','Integrações',670, true),
  ('em_desenvolvimento','admin_marketing_integracoes','Admin / Marketing Integracoes','/admin/marketing-integracoes','Marketing',680, true),
  ('em_desenvolvimento','dashboard_marketing_influencers','Marketing / Influencers','/dashboard/marketing/influencers','Marketing',690, true),
  ('em_desenvolvimento','dashboard_marketing_mining_data','Marketing / Mining Data','/dashboard/marketing/mining-data','Marketing',700, true),
  ('em_desenvolvimento','dashboard_marketing_redes_sociais','Marketing / Redes Sociais','/dashboard/marketing/redes-sociais','Marketing',710, true),
  ('em_desenvolvimento','dashboard_marketing_strategy','Marketing / Strategy','/dashboard/marketing/strategy','Marketing',720, true),
  ('em_desenvolvimento','dashboard_composicao_sync','Composicao / Sync','/dashboard/composicao/sync','Outros',730, true),
  ('em_desenvolvimento','dashboard_crm','Dashboard / CRM','/dashboard/crm','Outros',740, true),
  ('em_desenvolvimento','dashboard_departamentos','Dashboard / Departamentos','/dashboard/departamentos','Outros',750, true),
  ('em_desenvolvimento','dashboard_departamentos_aprovacoes','Departamentos / Aprovacoes','/dashboard/departamentos/aprovacoes','Outros',760, true),
  ('em_desenvolvimento','dashboard_design_studio','Dashboard / Design Studio','/dashboard/design-studio','Outros',770, true),
  ('em_desenvolvimento','dashboard_eventos_aprovacoes','Eventos / Aprovacoes','/dashboard/eventos/aprovacoes','Outros',780, true),
  ('em_desenvolvimento','dashboard_orcamento','Dashboard / Orcamento','/dashboard/orcamento','Outros',790, true),
  ('em_desenvolvimento','dashboard_simulacao','Dashboard / Simulacao','/dashboard/simulacao','Outros',800, true),
  ('em_desenvolvimento','dashboard_processos_etapas_gerenciamento','Processos / Etapas Gerenciamento','/dashboard/processos/etapas-gerenciamento','Processos',810, true),
  ('em_desenvolvimento','dashboard_processos_modulos_catalogo','Processos / Modulos Catalogo','/dashboard/processos/modulos-catalogo','Processos',820, true),
  ('em_desenvolvimento','dashboard_processos_perfis','Processos / Perfis','/dashboard/processos/perfis','Processos',830, true),
  ('em_desenvolvimento','dashboard_processos_perfis_novo','Perfis / Novo','/dashboard/processos/perfis/novo','Processos',840, true),
  ('em_desenvolvimento','dashboard_admin_projetos_custos_tecnologia','Admin / Projetos Custos Tecnologia','/dashboard/admin/projetos-custos-tecnologia','Projetos',850, true),
  ('em_desenvolvimento','dashboard_admin_projetos_saude','Admin / Projetos Saude','/dashboard/admin/projetos-saude','Projetos',860, true),
  ('em_desenvolvimento','dashboard_ajuda_projetos_visibilidade','Ajuda / Projetos Visibilidade','/dashboard/ajuda/projetos-visibilidade','Projetos',870, true),
  ('em_desenvolvimento','dashboard_projetos_admin_visibilidade','Admin / Visibilidade','/dashboard/projetos/admin/visibilidade','Projetos',880, true),
  ('em_desenvolvimento','dashboard_projetos_aprovacoes','Projetos / Aprovacoes','/dashboard/projetos/aprovacoes','Projetos',890, true),
  ('em_desenvolvimento','dashboard_projetos_central_preferencias','Central / Preferencias','/dashboard/projetos/central/preferencias','Projetos',900, true),
  ('em_desenvolvimento','dashboard_projetos_convites','Projetos / Convites','/dashboard/projetos/convites','Projetos',910, true),
  ('em_desenvolvimento','dashboard_projetos_home','Projetos / Home','/dashboard/projetos/home','Projetos',920, true),
  ('em_desenvolvimento','dashboard_projetos_visual_qa','Projetos / Visual Qa','/dashboard/projetos/visual-qa','Projetos',930, true),
  ('em_desenvolvimento','dashboard_prospects_lista','Prospects / Lista','/dashboard/prospects/lista','Prospects',940, true),
  ('em_desenvolvimento','dashboard_prospects_mapa','Prospects / Mapa','/dashboard/prospects/mapa','Prospects',950, true),
  ('em_desenvolvimento','dashboard_prospects_municipios','Prospects / Municipios','/dashboard/prospects/municipios','Prospects',960, true),
  ('em_desenvolvimento','dashboard_relatorios','Dashboard / Relatorios','/dashboard/relatorios','Relatórios',970, true),
  ('em_desenvolvimento','dashboard_admin_security_hardening','Security / Hardening','/dashboard/admin/security/hardening','Segurança',980, true),
  ('em_desenvolvimento','dashboard_admin_security_hardening_v2','Security / Hardening V2','/dashboard/admin/security/hardening-v2','Segurança',990, true),
  ('em_desenvolvimento','dashboard_admin_security_security_definer','Security / Security Definer','/dashboard/admin/security/security-definer','Segurança',1000, true),
  ('em_desenvolvimento','dashboard_security_explorer','Dashboard / Security Explorer','/dashboard/security-explorer','Segurança',1010, true),
  ('em_desenvolvimento','dashboard_security_mfa','Security / MFA','/dashboard/security/mfa','Segurança',1020, true),
  ('em_desenvolvimento','dashboard_seguranca_dashboard','Dashboard / Seguranca Dashboard','/dashboard/seguranca-dashboard','Segurança',1030, true),
  ('em_desenvolvimento','dashboard_trilha_auditoria_acessos','Dashboard / Trilha Auditoria Acessos','/dashboard/trilha-auditoria-acessos','Segurança',1040, true),
  ('em_desenvolvimento','dashboard_trade_admin_approval_levels','Admin / Approval Levels','/dashboard/trade/admin/approval-levels','Trade',1050, true),
  ('em_desenvolvimento','dashboard_trade_admin_executivo','Admin / Executivo','/dashboard/trade/admin/executivo','Trade',1060, true),
  ('em_desenvolvimento','dashboard_trade_admin_reports_campaigns','Reports / Campaigns','/dashboard/trade/admin/reports/campaigns','Trade',1070, true),
  ('em_desenvolvimento','dashboard_trade_admin_reports_clients','Reports / Clients','/dashboard/trade/admin/reports/clients','Trade',1080, true),
  ('em_desenvolvimento','dashboard_trade_admin_reports_sellers','Reports / Sellers','/dashboard/trade/admin/reports/sellers','Trade',1090, true),
  ('em_desenvolvimento','dashboard_trade_admin_users','Admin / Users','/dashboard/trade/admin/users','Trade',1100, true),
  ('em_desenvolvimento','dashboard_trade_brand_share','Trade / Brand Share','/dashboard/trade/brand-share','Trade',1110, true),
  ('em_desenvolvimento','dashboard_trade_campanhas_aprovacoes','Campanhas / Aprovacoes','/dashboard/trade/campanhas/aprovacoes','Trade',1120, true),
  ('em_desenvolvimento','dashboard_trade_competitors','Trade / Competitors','/dashboard/trade/competitors','Trade',1130, true),
  ('em_desenvolvimento','dashboard_trade_formularios_admin','Formularios / Admin','/dashboard/trade/formularios/admin','Trade',1140, true),
  ('em_desenvolvimento','dashboard_trade_formularios_builder','Formularios / Builder','/dashboard/trade/formularios/builder','Trade',1150, true),
  ('em_desenvolvimento','dashboard_trade_formularios_dashboard','Formularios / Dashboard','/dashboard/trade/formularios/dashboard','Trade',1160, true),
  ('em_desenvolvimento','dashboard_trade_import_stores','Trade / Import Stores','/dashboard/trade/import-stores','Trade',1170, true),
  ('em_desenvolvimento','dashboard_trade_materiais','Trade / Materiais','/dashboard/trade/materiais','Trade',1180, true),
  ('em_desenvolvimento','dashboard_trade_measurement_guide','Trade / Measurement Guide','/dashboard/trade/measurement-guide','Trade',1190, true),
  ('em_desenvolvimento','dashboard_trade_minhas_solicitacoes','Trade / Minhas Solicitacoes','/dashboard/trade/minhas-solicitacoes','Trade',1200, true);
