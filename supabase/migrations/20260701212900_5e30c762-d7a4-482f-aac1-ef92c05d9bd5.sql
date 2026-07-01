-- Reclassify 120 orphan routes from "em_desenvolvimento" into their real modules.
BEGIN;

DELETE FROM public.sidebar_menu_items
 WHERE module_code = 'em_desenvolvimento'
   AND item_code <> 'admin_solicitacoes_acesso';

INSERT INTO public.sidebar_menu_items
  (module_code, item_code, require_admin, label, route, parent_group, ordem, ativo)
VALUES
  ('configuracoes','admin_cofre_templates',TRUE,'Admin / Cofre Templates','/admin/cofre-templates','Admin/Governança',10,TRUE),
  ('configuracoes','admin_documentacao_tecnica',TRUE,'Admin / Documentacao Tecnica','/admin/documentacao-tecnica','Admin/Governança',20,TRUE),
  ('configuracoes','admin_suporte',TRUE,'Admin / Suporte','/admin/suporte','Admin/Governança',30,TRUE),
  ('configuracoes','admin_templates_alcadas',TRUE,'Admin / Templates Alcadas','/admin/templates-alcadas','Admin/Governança',40,TRUE),
  ('configuracoes','admin_uploads_rejeitados',TRUE,'Admin / Uploads Rejeitados','/admin/uploads-rejeitados','Admin/Governança',50,TRUE),
  ('configuracoes','admin_versoes_clientes',TRUE,'Admin / Versoes Clientes','/admin/versoes-clientes','Admin/Governança',60,TRUE),
  ('configuracoes','dashboard_admin_api_support',TRUE,'Dashboard / Admin API Support','/dashboard/admin-api-support','Admin/Governança',70,TRUE),
  ('configuracoes','dashboard_admin_alertas_backfill_tarefas',TRUE,'Admin / Alertas Backfill Tarefas','/dashboard/admin/alertas-backfill-tarefas','Admin/Governança',80,TRUE),
  ('configuracoes','dashboard_admin_checagem_semanal_tarefas',TRUE,'Admin / Checagem Semanal Tarefas','/dashboard/admin/checagem-semanal-tarefas','Admin/Governança',90,TRUE),
  ('configuracoes','dashboard_admin_dedupe_perfis',TRUE,'Admin / Dedupe Perfis','/dashboard/admin/dedupe-perfis','Admin/Governança',100,TRUE),
  ('configuracoes','dashboard_admin_diagnostico_tarefas_data_conclusao',TRUE,'Admin / Diagnostico Tarefas Data Conclusao','/dashboard/admin/diagnostico-tarefas-data-conclusao','Admin/Governança',110,TRUE),
  ('configuracoes','dashboard_admin_historico_backfill_tarefas',TRUE,'Admin / Historico Backfill Tarefas','/dashboard/admin/historico-backfill-tarefas','Admin/Governança',120,TRUE),
  ('configuracoes','dashboard_admin_relatorios_v2',TRUE,'Admin / Relatorios V2','/dashboard/admin/relatorios-v2','Admin/Governança',130,TRUE),
  ('configuracoes','dashboard_admin_relatorios_v2_novo',TRUE,'Relatorios V2 / Novo','/dashboard/admin/relatorios-v2/novo','Admin/Governança',140,TRUE),
  ('configuracoes','dashboard_admin_visibilidade_detalhe_tarefa',TRUE,'Admin / Visibilidade Detalhe Tarefa','/dashboard/admin/visibilidade-detalhe-tarefa','Admin/Governança',150,TRUE),
  ('projetos','dashboard_chat',FALSE,'Dashboard / Chat','/dashboard/chat','Chat',160,TRUE),
  ('projetos','dashboard_chat_aprovacoes',FALSE,'Chat / Aprovacoes','/dashboard/chat/aprovacoes','Chat',170,TRUE),
  ('comercial','dashboard_compras_internacionais',TRUE,'Dashboard / Compras Internacionais','/dashboard/compras-internacionais','Comercial/Operação',180,TRUE),
  ('comercial','dashboard_compras_internacionais_inbox',TRUE,'Compras Internacionais / Inbox','/dashboard/compras-internacionais/inbox','Comercial/Operação',190,TRUE),
  ('comercial','dashboard_compras_nacionais',TRUE,'Dashboard / Compras Nacionais','/dashboard/compras-nacionais','Comercial/Operação',200,TRUE),
  ('comercial','dashboard_configuracoes_fornecedores_visibilidade',TRUE,'Configuracoes / Fornecedores Visibilidade','/dashboard/configuracoes/fornecedores-visibilidade','Comercial/Operação',210,TRUE),
  ('estoque','dashboard_estoque_fornecedor',TRUE,'Estoque / Fornecedor','/dashboard/estoque/fornecedor','Comercial/Operação',220,TRUE),
  ('estoque','dashboard_estoque_fornecedor_depara',TRUE,'Estoque / Fornecedor Depara','/dashboard/estoque/fornecedor-depara','Comercial/Operação',230,TRUE),
  ('comercial','dashboard_fornecedor',TRUE,'Dashboard / Fornecedor','/dashboard/fornecedor','Comercial/Operação',240,TRUE),
  ('comercial','dashboard_fornecedor_analises',TRUE,'Fornecedor / Analises','/dashboard/fornecedor/analises','Comercial/Operação',250,TRUE),
  ('comercial','dashboard_fornecedor_pedidos_result',TRUE,'Fornecedor / Pedidos Result','/dashboard/fornecedor/pedidos-result','Comercial/Operação',260,TRUE),
  ('comercial','dashboard_importar_clientes',TRUE,'Dashboard / Importar Clientes','/dashboard/importar-clientes','Comercial/Operação',270,TRUE),
  ('comercial','dashboard_oms',TRUE,'Dashboard / OMS','/dashboard/oms','Comercial/Operação',280,TRUE),
  ('comercial','dashboard_oms_condicoes_pagamento',TRUE,'OMS / Condicoes Pagamento','/dashboard/oms/condicoes-pagamento','Comercial/Operação',290,TRUE),
  ('comercial','dashboard_vendas_analise',FALSE,'Vendas / Analise','/dashboard/vendas/analise','Comercial/Operação',300,TRUE),
  ('configuracoes','dashboard_configuracoes_api_health',TRUE,'Configuracoes / API Health','/dashboard/configuracoes/api-health','Configurações',310,TRUE),
  ('configuracoes','dashboard_preferencias_ui',TRUE,'Dashboard / Preferencias Ui','/dashboard/preferencias-ui','Configurações',320,TRUE),
  ('financeiro_contas_bancarias','dashboard_bancos',TRUE,'Dashboard / Bancos','/dashboard/bancos','Financeiro',330,TRUE),
  ('financeiro_contas_pagar','dashboard_contas_a_pagar',TRUE,'Dashboard / Contas A Pagar','/dashboard/contas-a-pagar','Financeiro',340,TRUE),
  ('financeiro_contas_pagar','dashboard_contas_pagar',TRUE,'Dashboard / Contas Pagar','/dashboard/contas-pagar','Financeiro',350,TRUE),
  ('financeiro_contas_pagar','dashboard_financeiro_contas_a_pagar_auditoria',TRUE,'Contas A Pagar / Auditoria','/dashboard/financeiro/contas-a-pagar/auditoria','Financeiro',360,TRUE),
  ('financeiro_contas_pagar','dashboard_financeiro_contas_a_pagar_novo',TRUE,'Contas A Pagar / Novo','/dashboard/financeiro/contas-a-pagar/novo','Financeiro',370,TRUE),
  ('financeiro_contas_pagar','dashboard_financeiro_contas_a_pagar_sync',TRUE,'Contas A Pagar / Sync','/dashboard/financeiro/contas-a-pagar/sync','Financeiro',380,TRUE),
  ('financeiro','dashboard_financeiro_contas_a_receber_auditoria',TRUE,'Contas A Receber / Auditoria','/dashboard/financeiro/contas-a-receber/auditoria','Financeiro',390,TRUE),
  ('financeiro','dashboard_financeiro_contas_a_receber_sync',TRUE,'Contas A Receber / Sync','/dashboard/financeiro/contas-a-receber/sync','Financeiro',400,TRUE),
  ('financeiro_fornecedores','dashboard_financeiro_fornecedores',TRUE,'Financeiro / Fornecedores','/dashboard/financeiro/fornecedores','Financeiro',410,TRUE),
  ('financeiro','dashboard_financeiro_trade',TRUE,'Financeiro / Trade','/dashboard/financeiro/trade','Financeiro',420,TRUE),
  ('financeiro','dashboard_financeiro_vendas_sync',TRUE,'Vendas / Sync','/dashboard/financeiro/vendas/sync','Financeiro',430,TRUE),
  ('financeiro_pagamentos','dashboard_pagamentos',TRUE,'Dashboard / Pagamentos','/dashboard/pagamentos','Financeiro',440,TRUE),
  ('financeiro_plano_contas_page','dashboard_plano_contas',TRUE,'Dashboard / Plano Contas','/dashboard/plano-contas','Financeiro',450,TRUE),
  ('financeiro','dashboard_trade_financeiro_dashboard',TRUE,'Financeiro / Dashboard','/dashboard/trade/financeiro/dashboard','Financeiro',460,TRUE),
  ('fabrica','dashboard_fabrica_analises_custos',TRUE,'Fabrica / Analises Custos','/dashboard/fabrica/analises-custos','Fábrica',470,TRUE),
  ('fabrica','dashboard_fabrica_auditoria_fotos',TRUE,'Fabrica / Auditoria Fotos','/dashboard/fabrica/auditoria-fotos','Fábrica',480,TRUE),
  ('fabrica','dashboard_fabrica_executivo',TRUE,'Fabrica / Executivo','/dashboard/fabrica/executivo','Fábrica',490,TRUE),
  ('fabrica','dashboard_fabrica_formulas_nova',TRUE,'Formulas / Nova','/dashboard/fabrica/formulas/nova','Fábrica',500,TRUE),
  ('fabrica','dashboard_fabrica_fornecedores',TRUE,'Fabrica / Fornecedores','/dashboard/fabrica/fornecedores','Fábrica',510,TRUE),
  ('fabrica','dashboard_fabrica_manual',TRUE,'Fabrica / Manual','/dashboard/fabrica/manual','Fábrica',520,TRUE),
  ('fabrica','dashboard_fabrica_produtos_importar',TRUE,'Produtos / Importar','/dashboard/fabrica/produtos/importar','Fábrica',530,TRUE),
  ('china','dashboard_fabrica_china_auditoria_normalizacao',FALSE,'Fabrica China / Auditoria Normalizacao','/dashboard/fabrica-china/auditoria-normalizacao','Fábrica China',540,TRUE),
  ('china','dashboard_fabrica_china_caixa_entrada',FALSE,'Fabrica China / Caixa Entrada','/dashboard/fabrica-china/caixa-entrada','Fábrica China',550,TRUE),
  ('china','dashboard_fabrica_china_ordens_producao',FALSE,'Fabrica China / Ordens Producao','/dashboard/fabrica-china/ordens-producao','Fábrica China',560,TRUE),
  ('china','dashboard_fabrica_china_patio_embarque',FALSE,'Fabrica China / Patio Embarque','/dashboard/fabrica-china/patio-embarque','Fábrica China',570,TRUE),
  ('china','dashboard_fabrica_china_recebimentos_oc',FALSE,'Fabrica China / Recebimentos Oc','/dashboard/fabrica-china/recebimentos-oc','Fábrica China',580,TRUE),
  ('china','dashboard_fabrica_china_recebimentos_divergencias',FALSE,'Recebimentos / Divergencias','/dashboard/fabrica-china/recebimentos/divergencias','Fábrica China',590,TRUE),
  ('china','dashboard_fabrica_china_torre_containers',FALSE,'Fabrica China / Torre Containers','/dashboard/fabrica-china/torre-containers','Fábrica China',600,TRUE),
  ('configuracoes','admin_integracoes_saude',TRUE,'Admin / Integracoes Saude','/admin/integracoes-saude','Integrações',610,TRUE),
  ('configuracoes','admin_integracoes_google_drive',TRUE,'Integracoes / Google Drive','/admin/integracoes/google-drive','Integrações',620,TRUE),
  ('configuracoes','dashboard_admin_asana_importacao',TRUE,'Admin / Asana Importacao','/dashboard/admin/asana-importacao','Integrações',630,TRUE),
  ('configuracoes','dashboard_admin_asana_sync',TRUE,'Admin / Asana Sync','/dashboard/admin/asana-sync','Integrações',640,TRUE),
  ('configuracoes','dashboard_integracoes_asana',TRUE,'Integracoes / Asana','/dashboard/integracoes/asana','Integrações',650,TRUE),
  ('configuracoes','dashboard_integracoes_notion',TRUE,'Integracoes / Notion','/dashboard/integracoes/notion','Integrações',660,TRUE),
  ('configuracoes','dashboard_integracoes_shipsgo',TRUE,'Integracoes / Shipsgo','/dashboard/integracoes/shipsgo','Integrações',670,TRUE),
  ('marketing','admin_marketing_integracoes',TRUE,'Admin / Marketing Integracoes','/admin/marketing-integracoes','Marketing',680,TRUE),
  ('marketing','dashboard_marketing_influencers',FALSE,'Marketing / Influencers','/dashboard/marketing/influencers','Marketing',690,TRUE),
  ('marketing','dashboard_marketing_mining_data',FALSE,'Marketing / Mining Data','/dashboard/marketing/mining-data','Marketing',700,TRUE),
  ('marketing','dashboard_marketing_redes_sociais',FALSE,'Marketing / Redes Sociais','/dashboard/marketing/redes-sociais','Marketing',710,TRUE),
  ('marketing','dashboard_marketing_strategy',FALSE,'Marketing / Strategy','/dashboard/marketing/strategy','Marketing',720,TRUE),
  ('composicao','dashboard_composicao_sync',TRUE,'Composicao / Sync','/dashboard/composicao/sync','Outros',730,TRUE),
  ('comercial','dashboard_crm',FALSE,'Dashboard / CRM','/dashboard/crm','Outros',740,TRUE),
  ('departamentos','dashboard_departamentos',TRUE,'Dashboard / Departamentos','/dashboard/departamentos','Outros',750,TRUE),
  ('departamentos','dashboard_departamentos_aprovacoes',TRUE,'Departamentos / Aprovacoes','/dashboard/departamentos/aprovacoes','Outros',760,TRUE),
  ('marketing','dashboard_design_studio',FALSE,'Dashboard / Design Studio','/dashboard/design-studio','Outros',770,TRUE),
  ('eventos','dashboard_eventos_aprovacoes',TRUE,'Eventos / Aprovacoes','/dashboard/eventos/aprovacoes','Outros',780,TRUE),
  ('financeiro','dashboard_orcamento',TRUE,'Dashboard / Orcamento','/dashboard/orcamento','Outros',790,TRUE),
  ('financeiro','dashboard_simulacao',TRUE,'Dashboard / Simulacao','/dashboard/simulacao','Outros',800,TRUE),
  ('processos','dashboard_processos_etapas_gerenciamento',TRUE,'Processos / Etapas Gerenciamento','/dashboard/processos/etapas-gerenciamento','Processos',810,TRUE),
  ('processos','dashboard_processos_modulos_catalogo',TRUE,'Processos / Modulos Catalogo','/dashboard/processos/modulos-catalogo','Processos',820,TRUE),
  ('processos','dashboard_processos_perfis',TRUE,'Processos / Perfis','/dashboard/processos/perfis','Processos',830,TRUE),
  ('processos','dashboard_processos_perfis_novo',TRUE,'Perfis / Novo','/dashboard/processos/perfis/novo','Processos',840,TRUE),
  ('projetos','dashboard_admin_projetos_custos_tecnologia',TRUE,'Admin / Projetos Custos Tecnologia','/dashboard/admin/projetos-custos-tecnologia','Projetos',850,TRUE),
  ('projetos','dashboard_admin_projetos_saude',TRUE,'Admin / Projetos Saude','/dashboard/admin/projetos-saude','Projetos',860,TRUE),
  ('projetos','dashboard_ajuda_projetos_visibilidade',FALSE,'Ajuda / Projetos Visibilidade','/dashboard/ajuda/projetos-visibilidade','Projetos',870,TRUE),
  ('projetos','dashboard_projetos_admin_visibilidade',TRUE,'Admin / Visibilidade','/dashboard/projetos/admin/visibilidade','Projetos',880,TRUE),
  ('projetos','dashboard_projetos_aprovacoes',FALSE,'Projetos / Aprovacoes','/dashboard/projetos/aprovacoes','Projetos',890,TRUE),
  ('projetos','dashboard_projetos_central_preferencias',FALSE,'Central / Preferencias','/dashboard/projetos/central/preferencias','Projetos',900,TRUE),
  ('projetos','dashboard_projetos_convites',TRUE,'Projetos / Convites','/dashboard/projetos/convites','Projetos',910,TRUE),
  ('projetos','dashboard_projetos_home',FALSE,'Projetos / Home','/dashboard/projetos/home','Projetos',920,TRUE),
  ('projetos','dashboard_projetos_visual_qa',TRUE,'Projetos / Visual Qa','/dashboard/projetos/visual-qa','Projetos',930,TRUE),
  ('prospects','dashboard_prospects_lista',FALSE,'Prospects / Lista','/dashboard/prospects/lista','Prospects',940,TRUE),
  ('prospects','dashboard_prospects_mapa',FALSE,'Prospects / Mapa','/dashboard/prospects/mapa','Prospects',950,TRUE),
  ('prospects','dashboard_prospects_municipios',FALSE,'Prospects / Municipios','/dashboard/prospects/municipios','Prospects',960,TRUE),
  ('configuracoes','dashboard_relatorios',TRUE,'Dashboard / Relatorios','/dashboard/relatorios','Relatórios',970,TRUE),
  ('configuracoes','dashboard_admin_security_hardening',TRUE,'Security / Hardening','/dashboard/admin/security/hardening','Segurança',980,TRUE),
  ('configuracoes','dashboard_admin_security_hardening_v2',TRUE,'Security / Hardening V2','/dashboard/admin/security/hardening-v2','Segurança',990,TRUE),
  ('configuracoes','dashboard_admin_security_security_definer',TRUE,'Security / Security Definer','/dashboard/admin/security/security-definer','Segurança',1000,TRUE),
  ('configuracoes','dashboard_security_explorer',TRUE,'Dashboard / Security Explorer','/dashboard/security-explorer','Segurança',1010,TRUE),
  ('configuracoes','dashboard_security_mfa',TRUE,'Security / MFA','/dashboard/security/mfa','Segurança',1020,TRUE),
  ('configuracoes','dashboard_seguranca_dashboard',TRUE,'Dashboard / Seguranca Dashboard','/dashboard/seguranca-dashboard','Segurança',1030,TRUE),
  ('configuracoes','dashboard_trilha_auditoria_acessos',TRUE,'Dashboard / Trilha Auditoria Acessos','/dashboard/trilha-auditoria-acessos','Segurança',1040,TRUE),
  ('trade','dashboard_trade_admin_approval_levels',TRUE,'Admin / Approval Levels','/dashboard/trade/admin/approval-levels','Trade',1050,TRUE),
  ('trade','dashboard_trade_admin_executivo',TRUE,'Admin / Executivo','/dashboard/trade/admin/executivo','Trade',1060,TRUE),
  ('trade','dashboard_trade_admin_reports_campaigns',TRUE,'Reports / Campaigns','/dashboard/trade/admin/reports/campaigns','Trade',1070,TRUE),
  ('trade','dashboard_trade_admin_reports_clients',TRUE,'Reports / Clients','/dashboard/trade/admin/reports/clients','Trade',1080,TRUE),
  ('trade','dashboard_trade_admin_reports_sellers',TRUE,'Reports / Sellers','/dashboard/trade/admin/reports/sellers','Trade',1090,TRUE),
  ('trade','dashboard_trade_admin_users',TRUE,'Admin / Users','/dashboard/trade/admin/users','Trade',1100,TRUE),
  ('trade','dashboard_trade_brand_share',FALSE,'Trade / Brand Share','/dashboard/trade/brand-share','Trade',1110,TRUE),
  ('trade','dashboard_trade_campanhas_aprovacoes',TRUE,'Campanhas / Aprovacoes','/dashboard/trade/campanhas/aprovacoes','Trade',1120,TRUE),
  ('trade','dashboard_trade_competitors',FALSE,'Trade / Competitors','/dashboard/trade/competitors','Trade',1130,TRUE),
  ('trade','dashboard_trade_formularios_admin',TRUE,'Formularios / Admin','/dashboard/trade/formularios/admin','Trade',1140,TRUE),
  ('trade','dashboard_trade_formularios_builder',TRUE,'Formularios / Builder','/dashboard/trade/formularios/builder','Trade',1150,TRUE),
  ('trade','dashboard_trade_formularios_dashboard',FALSE,'Formularios / Dashboard','/dashboard/trade/formularios/dashboard','Trade',1160,TRUE),
  ('trade','dashboard_trade_import_stores',FALSE,'Trade / Import Stores','/dashboard/trade/import-stores','Trade',1170,TRUE),
  ('trade','dashboard_trade_materiais',FALSE,'Trade / Materiais','/dashboard/trade/materiais','Trade',1180,TRUE),
  ('trade','dashboard_trade_measurement_guide',FALSE,'Trade / Measurement Guide','/dashboard/trade/measurement-guide','Trade',1190,TRUE),
  ('trade','dashboard_trade_minhas_solicitacoes',FALSE,'Trade / Minhas Solicitacoes','/dashboard/trade/minhas-solicitacoes','Trade',1200,TRUE)
ON CONFLICT (module_code, item_code) DO UPDATE
   SET label = EXCLUDED.label,
       route = EXCLUDED.route,
       parent_group = EXCLUDED.parent_group,
       require_admin = EXCLUDED.require_admin,
       ativo = TRUE;

-- Retire the (never-active) "Em Desenvolvimento" category/module link.
UPDATE public.sidebar_category_modules SET ativo = FALSE WHERE module_code = 'em_desenvolvimento';
UPDATE public.sidebar_categories       SET ativo = FALSE WHERE key = 'em_desenvolvimento';

-- Safety net: finish unifying the duplicate "$" category.
DO $mig$
DECLARE
  v_fin_id uuid;
  v_precos_cat_id uuid;
BEGIN
  SELECT id INTO v_fin_id        FROM public.sidebar_categories WHERE key = 'financeiro_admin';
  SELECT id INTO v_precos_cat_id FROM public.sidebar_categories WHERE key = 'precos';
  IF v_fin_id IS NOT NULL AND v_precos_cat_id IS NOT NULL THEN
    INSERT INTO public.sidebar_category_modules
      (category_id, module_code, label_override, icon_override, ordem, ativo)
    SELECT v_fin_id, cm.module_code,
           COALESCE(cm.label_override,'Tabelas de Preço'),
           COALESCE(cm.icon_override,'DollarSign'),
           20, true
      FROM public.sidebar_category_modules cm
     WHERE cm.category_id = v_precos_cat_id AND cm.ativo
    ON CONFLICT (category_id, module_code) DO NOTHING;

    UPDATE public.sidebar_category_modules SET ativo = false WHERE category_id = v_precos_cat_id;
    UPDATE public.sidebar_categories       SET ativo = false WHERE id = v_precos_cat_id;
  END IF;
END $mig$;

COMMIT;