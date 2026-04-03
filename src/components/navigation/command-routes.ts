/**
 * Índice de rotas para o Command Palette (Ctrl+K).
 * Cada rota tem título, path, módulo, ícone e screenCode para filtragem por permissão.
 */

export interface CommandRoute {
  title: string;
  path: string;
  module: string;
  icon: string;
  screenCode?: string;
  moduleCode?: string;
  keywords?: string[];
}

export const commandRoutes: CommandRoute[] = [
  // --- Dashboard / Geral ---
  { title: "Dashboard", path: "/dashboard", module: "Geral", icon: "Home", keywords: ["inicio", "home"] },
  { title: "Tarefas", path: "/dashboard/tarefas", module: "Geral", icon: "CheckSquare", keywords: ["tasks", "todo"] },
  { title: "Chat", path: "/dashboard/chat", module: "Geral", icon: "MessageSquare", keywords: ["mensagem", "conversa"] },
  { title: "Instalar App", path: "/dashboard/instalar-app", module: "Geral", icon: "Download", keywords: ["pwa", "mobile"] },
  { title: "Configurações", path: "/dashboard/configuracoes", module: "Admin", icon: "Settings", screenCode: "admin", keywords: ["config", "ajustes"] },
  { title: "Auditoria", path: "/dashboard/auditoria", module: "Admin", icon: "Shield", screenCode: "auditoria", keywords: ["logs", "audit"] },
  { title: "Demandas Internas", path: "/dashboard/demandas", module: "Admin", icon: "Ticket", screenCode: "admin" },
  { title: "Relatórios", path: "/dashboard/relatorios", module: "Geral", icon: "FileText", screenCode: "relatorios" },

  // --- Prospects (CRM) ---
  { title: "Prospects — Módulo", path: "/dashboard/prospects", module: "Prospects", icon: "Users", moduleCode: "prospects" },
  { title: "Lista de Prospects", path: "/dashboard/prospects/lista", module: "Prospects", icon: "Users", moduleCode: "prospects", screenCode: "prospects_lista", keywords: ["clientes", "leads"] },
  { title: "Kanban de Prospects", path: "/dashboard/prospects/kanban", module: "Prospects", icon: "LayoutGrid", moduleCode: "prospects", screenCode: "prospects_kanban", keywords: ["pipeline", "funil"] },
  { title: "Atividades", path: "/dashboard/prospects/atividades", module: "Prospects", icon: "Activity", moduleCode: "prospects", screenCode: "prospects_atividades", keywords: ["followup", "agenda"] },
  { title: "Mapa de Prospects", path: "/dashboard/prospects/mapa", module: "Prospects", icon: "MapPin", moduleCode: "prospects", screenCode: "prospects_mapa" },
  { title: "Municípios", path: "/dashboard/prospects/municipios", module: "Prospects", icon: "MapPin", moduleCode: "prospects", screenCode: "prospects_municipios" },

  // --- Marketing ---
  { title: "Marketing — Módulo", path: "/dashboard/marketing", module: "Marketing", icon: "Megaphone", moduleCode: "marketing" },
  { title: "Marketing Social", path: "/dashboard/marketing/social", module: "Marketing", icon: "BarChart3", moduleCode: "marketing", screenCode: "marketing_social" },
  { title: "WhatsApp Monitoring", path: "/dashboard/marketing/whatsapp", module: "Marketing", icon: "MessageSquare", moduleCode: "marketing", screenCode: "marketing_whatsapp" },
  { title: "ElevenLabs Studio", path: "/dashboard/marketing/elevenlabs", module: "Marketing", icon: "Mic", moduleCode: "marketing", screenCode: "marketing_elevenlabs" },

  // --- Trade Marketing ---
  { title: "Trade Marketing — Módulo", path: "/dashboard/trade", module: "Trade", icon: "Store", moduleCode: "trade" },
  { title: "Lojas (PDVs)", path: "/dashboard/trade/stores", module: "Trade", icon: "Store", moduleCode: "trade", screenCode: "trade_stores" },
  { title: "Redes de Lojas", path: "/dashboard/trade/store-chains", module: "Trade", icon: "Store", moduleCode: "trade", screenCode: "trade_stores" },
  { title: "Visitas", path: "/dashboard/trade/visits", module: "Trade", icon: "Calendar", moduleCode: "trade", screenCode: "trade_visits" },
  { title: "Fotos", path: "/dashboard/trade/photos", module: "Trade", icon: "Camera", moduleCode: "trade", screenCode: "trade_photos" },
  { title: "Concorrentes", path: "/dashboard/trade/competitors", module: "Trade", icon: "Users", moduleCode: "trade", screenCode: "trade_competitors" },
  { title: "Promoções", path: "/dashboard/trade/promotions", module: "Trade", icon: "Tag", moduleCode: "trade", screenCode: "trade_promotions" },
  { title: "Insights Trade", path: "/dashboard/trade/insights", module: "Trade", icon: "TrendingUp", moduleCode: "trade", screenCode: "trade_insights" },
  { title: "Calendário Trade", path: "/dashboard/trade/calendar", module: "Trade", icon: "Calendar", moduleCode: "trade", screenCode: "trade_calendar" },
  { title: "Fotos Ideais", path: "/dashboard/trade/ideal-photos", module: "Trade", icon: "Image", moduleCode: "trade", screenCode: "trade_ideal_photos" },
  { title: "Ranking", path: "/dashboard/ranking", module: "Trade", icon: "Trophy", moduleCode: "trade", screenCode: "trade_ranking" },
  { title: "Auditorias Trade", path: "/dashboard/trade/auditorias", module: "Trade", icon: "ClipboardCheck", moduleCode: "trade", screenCode: "trade_auditorias" },
  { title: "Sell Out", path: "/dashboard/trade/sellout", module: "Trade", icon: "TrendingUp", moduleCode: "trade", screenCode: "trade_sellout" },
  { title: "Medição Gôndola", path: "/dashboard/trade/shelf-measurements", module: "Trade", icon: "BarChart3", moduleCode: "trade", screenCode: "trade_shelf" },
  { title: "Nossas Marcas", path: "/dashboard/trade/our-brands", module: "Trade", icon: "Tag", moduleCode: "trade", screenCode: "trade_brands" },
  { title: "Brand Share", path: "/dashboard/trade/brand-share", module: "Trade", icon: "BarChart3", moduleCode: "trade", screenCode: "trade_brands" },
  { title: "Performance Trade", path: "/dashboard/trade/performance", module: "Trade", icon: "TrendingUp", moduleCode: "trade", screenCode: "trade_performance" },
  { title: "Rewards", path: "/dashboard/trade/rewards", module: "Trade", icon: "Trophy", moduleCode: "trade", screenCode: "trade_rewards" },
  { title: "Minhas Solicitações", path: "/dashboard/trade/minhas-solicitacoes", module: "Trade", icon: "Inbox", moduleCode: "trade", screenCode: "trade_solicitacoes" },
  { title: "Materiais Trade", path: "/dashboard/trade/materiais", module: "Trade", icon: "Package", moduleCode: "trade", screenCode: "trade_materiais" },

  // --- Trade Admin ---
  { title: "Trade Admin", path: "/dashboard/trade/admin", module: "Trade Admin", icon: "Settings", moduleCode: "trade", screenCode: "trade_admin" },
  { title: "Trade Financeiro", path: "/dashboard/trade/financeiro", module: "Trade Admin", icon: "DollarSign", moduleCode: "trade", screenCode: "trade_admin" },
  { title: "Trade Campanhas", path: "/dashboard/trade/financeiro/campanhas", module: "Trade Admin", icon: "Rocket", moduleCode: "trade", screenCode: "trade_admin" },
  { title: "Trade Aprovações", path: "/dashboard/trade/aprovacoes", module: "Trade Admin", icon: "CheckSquare", moduleCode: "trade", screenCode: "trade_admin" },
  { title: "Trade Dashboard Executivo", path: "/dashboard/trade/admin/executivo", module: "Trade Admin", icon: "BarChart3", moduleCode: "trade", screenCode: "trade_admin" },

  // --- Fábrica ---
  { title: "Fábrica — Módulo", path: "/dashboard/fabrica", module: "Fábrica", icon: "Factory", moduleCode: "fabrica" },
  { title: "Recebimento NF-e", path: "/dashboard/fabrica/recebimentos", module: "Fábrica", icon: "Upload", moduleCode: "fabrica", screenCode: "fabrica_recebimentos" },
  { title: "Matérias-Primas", path: "/dashboard/fabrica/materias-primas", module: "Fábrica", icon: "Package", moduleCode: "fabrica", screenCode: "fabrica_mps" },
  { title: "Fórmulas (BOM)", path: "/dashboard/fabrica/formulas", module: "Fábrica", icon: "FileText", moduleCode: "fabrica", screenCode: "fabrica_formulas" },
  { title: "Planejamento MRP", path: "/dashboard/fabrica/planejamento", module: "Fábrica", icon: "Calendar", moduleCode: "fabrica", screenCode: "fabrica_planejamento" },
  { title: "Ordens de Produção", path: "/dashboard/fabrica/ordens-producao", module: "Fábrica", icon: "ClipboardCheck", moduleCode: "fabrica", screenCode: "fabrica_producao" },
  { title: "Apontamentos", path: "/dashboard/fabrica/apontamentos", module: "Fábrica", icon: "Clock", moduleCode: "fabrica", screenCode: "fabrica_apontamentos" },
  { title: "Qualidade", path: "/dashboard/fabrica/qualidade", module: "Fábrica", icon: "AlertCircle", moduleCode: "fabrica", screenCode: "fabrica_qualidade" },
  { title: "Paradas", path: "/dashboard/fabrica/paradas", module: "Fábrica", icon: "Pause", moduleCode: "fabrica", screenCode: "fabrica_paradas" },
  { title: "Máquinas", path: "/dashboard/fabrica/maquinas", module: "Fábrica", icon: "Wrench", moduleCode: "fabrica", screenCode: "fabrica_maquinas" },
  { title: "Operadores", path: "/dashboard/fabrica/operadores", module: "Fábrica", icon: "UserCircle", moduleCode: "fabrica", screenCode: "fabrica_operadores" },
  { title: "Produtos Acabados", path: "/dashboard/fabrica/produtos-acabados", module: "Fábrica", icon: "Package", moduleCode: "fabrica", screenCode: "fabrica_produtos" },
  { title: "Fiscal", path: "/dashboard/fabrica/fiscal", module: "Fábrica", icon: "Receipt", moduleCode: "fabrica", screenCode: "fabrica_fiscal" },
  { title: "Tabela de Impostos", path: "/dashboard/fabrica/tabela-impostos", module: "Fábrica", icon: "FileText", moduleCode: "fabrica", screenCode: "fabrica_impostos" },
  { title: "Tabelas de Preços", path: "/dashboard/fabrica/tabelas-preco", module: "Fábrica", icon: "DollarSign", moduleCode: "fabrica", screenCode: "fabrica_tabelas_preco" },
  { title: "Lançamentos Fábrica", path: "/dashboard/fabrica/lancamentos", module: "Fábrica", icon: "FileText", moduleCode: "fabrica", screenCode: "fabrica_lancamentos" },
  { title: "Dashboard Executivo Fábrica", path: "/dashboard/fabrica/executivo", module: "Fábrica", icon: "BarChart3", moduleCode: "fabrica", screenCode: "fabrica_executivo" },
  { title: "Fornecedores Fábrica", path: "/dashboard/fabrica/fornecedores", module: "Fábrica", icon: "Building2", moduleCode: "fabrica", screenCode: "fabrica_fornecedores" },

  // --- Financeiro ---
  { title: "Financeiro — Módulo", path: "/dashboard/financeiro", module: "Financeiro", icon: "DollarSign", moduleCode: "financeiro" },
  { title: "Contas a Pagar", path: "/dashboard/financeiro/contas-a-pagar", module: "Financeiro", icon: "DollarSign", moduleCode: "financeiro", screenCode: "fin_ap", keywords: ["ap", "fornecedores"] },
  { title: "Contas a Receber", path: "/dashboard/financeiro/contas-a-receber", module: "Financeiro", icon: "DollarSign", moduleCode: "financeiro", screenCode: "fin_ar", keywords: ["ar", "clientes", "cobranca"] },
  { title: "Fluxo de Caixa", path: "/dashboard/financeiro/fluxo-de-caixa", module: "Financeiro", icon: "TrendingUp", moduleCode: "financeiro", screenCode: "fin_cashflow", keywords: ["cashflow"] },
  { title: "Saldos Bancários", path: "/dashboard/financeiro/saldos-bancarios", module: "Financeiro", icon: "Landmark", moduleCode: "financeiro", screenCode: "fin_saldos" },
  { title: "Plano de Contas", path: "/dashboard/financeiro/plano-de-contas", module: "Financeiro", icon: "FileText", moduleCode: "financeiro", screenCode: "fin_plano_contas" },
  { title: "DRE Analítico", path: "/dashboard/financeiro/dre", module: "Financeiro", icon: "BarChart3", moduleCode: "financeiro", screenCode: "fin_dre" },
  { title: "Cobrança Inadimplentes", path: "/dashboard/financeiro/cobranca", module: "Financeiro", icon: "AlertTriangle", moduleCode: "financeiro", screenCode: "fin_cobranca" },
  { title: "Conciliação Bancária", path: "/dashboard/financeiro/conciliacao", module: "Financeiro", icon: "Scale", moduleCode: "financeiro", screenCode: "fin_conciliacao" },
  { title: "Investimentos", path: "/dashboard/financeiro/investimentos", module: "Financeiro", icon: "TrendingUp", moduleCode: "financeiro", screenCode: "fin_investimentos" },
  { title: "Dashboard Financeiro Consolidado", path: "/dashboard/financeiro/consolidado", module: "Financeiro", icon: "BarChart3", moduleCode: "financeiro", screenCode: "fin_consolidado" },
  { title: "Empresas", path: "/dashboard/financeiro/empresas", module: "Financeiro", icon: "Building2", moduleCode: "financeiro", screenCode: "fin_empresas" },
  { title: "Centros de Custo", path: "/dashboard/financeiro/centros-custo", module: "Financeiro", icon: "Layers", moduleCode: "financeiro", screenCode: "fin_centros_custo" },
  { title: "Contas Bancárias", path: "/dashboard/financeiro/contas-bancarias", module: "Financeiro", icon: "CreditCard", moduleCode: "financeiro", screenCode: "fin_contas_bancarias" },
  { title: "Central de Pagamentos", path: "/dashboard/financeiro/central-pagamentos", module: "Financeiro", icon: "Wallet", moduleCode: "financeiro", screenCode: "fin_central_pag" },
  { title: "Painel Central AP", path: "/dashboard/financeiro/painel-central-ap", module: "Financeiro", icon: "BarChart3", moduleCode: "financeiro", screenCode: "admin" },

  // --- Comercial ---
  { title: "Comercial — Módulo", path: "/dashboard/comercial", module: "Comercial", icon: "ShoppingCart", moduleCode: "comercial" },
  { title: "Whitespace Analysis", path: "/dashboard/comercial/whitespace", module: "Comercial", icon: "Compass", moduleCode: "comercial", screenCode: "comercial_whitespace" },
  { title: "Lead Mining", path: "/dashboard/comercial/lead-mining", module: "Comercial", icon: "Pickaxe", moduleCode: "comercial", screenCode: "comercial_leadmining" },
  { title: "Market Intelligence", path: "/dashboard/comercial/market-intelligence", module: "Comercial", icon: "Brain", moduleCode: "comercial", screenCode: "comercial_market" },
  { title: "Reativação de Clientes", path: "/dashboard/comercial/reactivation", module: "Comercial", icon: "RefreshCw", moduleCode: "comercial", screenCode: "comercial_reactivation" },
  { title: "Mapa Comercial", path: "/dashboard/comercial/mapa", module: "Comercial", icon: "MapPin", moduleCode: "comercial", screenCode: "comercial_mapa" },
  { title: "Importar Clientes", path: "/dashboard/importar-clientes", module: "Comercial", icon: "Upload", moduleCode: "comercial", screenCode: "comercial_importar" },

  // --- Eventos Corporativos ---
  { title: "Eventos — Lista", path: "/dashboard/eventos", module: "Eventos", icon: "CalendarDays", moduleCode: "eventos", screenCode: "eventos_lista" },
  { title: "Eventos — Aprovações", path: "/dashboard/eventos/aprovacoes", module: "Eventos", icon: "CheckSquare", moduleCode: "eventos", screenCode: "eventos_aprovacoes" },
  { title: "Eventos — Dashboard", path: "/dashboard/eventos/dashboard", module: "Eventos", icon: "BarChart3", moduleCode: "eventos", screenCode: "eventos_dashboard" },

  // --- Departamentos ---
  { title: "Departamentos", path: "/dashboard/departamentos", module: "Departamentos", icon: "Building2", moduleCode: "departamentos", screenCode: "departamentos_hub" },
  { title: "Departamentos — Aprovações", path: "/dashboard/departamentos/aprovacoes", module: "Departamentos", icon: "CheckSquare", moduleCode: "departamentos", screenCode: "departamentos_aprovacoes" },

  // --- China ---
  { title: "Fábrica China", path: "/dashboard/fabrica-china", module: "China", icon: "Globe", moduleCode: "china", screenCode: "china_submissoes" },
  { title: "China — Ordens de Compra", path: "/dashboard/fabrica-china/ordens", module: "China", icon: "ShoppingCart", moduleCode: "china", screenCode: "china_ordens" },
  { title: "China — Recebimentos", path: "/dashboard/fabrica-china/recebimentos", module: "China", icon: "Upload", moduleCode: "china", screenCode: "china_recebimentos" },

  // --- Projetos ---
  { title: "Projetos", path: "/dashboard/projetos", module: "Projetos", icon: "FolderKanban", moduleCode: "projetos", screenCode: "projetos_lista" },
  { title: "Meu Inbox Projetos", path: "/dashboard/projetos/inbox", module: "Projetos", icon: "Inbox", moduleCode: "projetos", screenCode: "projetos_inbox" },
  { title: "Minhas Tarefas", path: "/dashboard/projetos/minhas-tarefas", module: "Projetos", icon: "CheckSquare", moduleCode: "projetos", screenCode: "projetos_tarefas" },

  // --- Reuniões ---
  { title: "Reuniões", path: "/dashboard/reunioes", module: "Reuniões", icon: "Mic", moduleCode: "reunioes", screenCode: "reunioes_lista" },

  // --- Estoque ---
  { title: "Estoque — Módulo", path: "/dashboard/estoque", module: "Estoque", icon: "Package", moduleCode: "estoque" },
  { title: "Distribuidoras", path: "/dashboard/estoque/distribuidoras", module: "Estoque", icon: "Building2", moduleCode: "estoque", screenCode: "estoque_distribuidoras" },
  { title: "Produtos Master", path: "/dashboard/estoque/produtos", module: "Estoque", icon: "Package", moduleCode: "estoque", screenCode: "estoque_produtos" },
  { title: "Saldos Estoque", path: "/dashboard/estoque/saldos", module: "Estoque", icon: "BarChart3", moduleCode: "estoque", screenCode: "estoque_saldos" },
  { title: "Estoque Consolidado", path: "/dashboard/estoque/consolidado", module: "Estoque", icon: "Layers", moduleCode: "estoque", screenCode: "estoque_consolidado" },

  // --- Inteligência ---
  { title: "Painel Executivo", path: "/dashboard/painel-executivo", module: "Inteligência", icon: "BarChart3", screenCode: "intel_painel" },
  { title: "Performance de Vendas", path: "/dashboard/performance-vendas", module: "Inteligência", icon: "TrendingUp", screenCode: "intel_performance" },
  { title: "Análise de Clientes", path: "/dashboard/clientes", module: "Inteligência", icon: "Users", screenCode: "intel_clientes" },
  { title: "Detalhamento de Vendas", path: "/dashboard/detalhamento", module: "Inteligência", icon: "FileText", screenCode: "intel_detalhamento" },
  { title: "Análise Geográfica", path: "/dashboard/geografico", module: "Inteligência", icon: "MapPin", screenCode: "intel_geo" },
  { title: "Análise de Produtos", path: "/dashboard/produtos", module: "Inteligência", icon: "Package", screenCode: "intel_produtos" },
  { title: "Metas e Projeções", path: "/dashboard/metas", module: "Inteligência", icon: "Target", screenCode: "intel_metas" },
  { title: "Consolidado", path: "/dashboard/consolidado", module: "Inteligência", icon: "Layers", screenCode: "intel_consolidado" },

  // --- IA ---
  { title: "AI Analytics", path: "/dashboard/ai-analytics", module: "IA", icon: "Brain", screenCode: "ai_analytics" },
  { title: "Agente Huggs", path: "/dashboard/agente-huggs", module: "IA", icon: "Bot", screenCode: "ai_analytics" },
  { title: "QA Agent", path: "/dashboard/qa-agent", module: "IA", icon: "Shield", screenCode: "ai_analytics" },

  // --- Segurança ---
  { title: "Security Dashboard", path: "/dashboard/seguranca-dashboard", module: "Segurança", icon: "Shield", screenCode: "admin" },
  { title: "Security Event Explorer", path: "/dashboard/seguranca-eventos", module: "Segurança", icon: "Shield", screenCode: "admin" },
  { title: "Relatório de Segurança", path: "/dashboard/seguranca", module: "Segurança", icon: "Shield", screenCode: "admin" },
  { title: "Relatório APIs", path: "/dashboard/relatorio-apis", module: "Admin", icon: "Network", screenCode: "admin" },
  { title: "Relatório Desenvolvimento", path: "/dashboard/relatorio-desenvolvimento", module: "Admin", icon: "FileText", screenCode: "admin" },

  // --- OMS ---
  { title: "OMS — Painel de Pedidos", path: "/dashboard/oms/pedidos", module: "OMS", icon: "ShoppingCart", moduleCode: "oms", screenCode: "oms_pedidos" },
  { title: "OMS — Condições de Pagamento", path: "/dashboard/oms/condicoes", module: "OMS", icon: "CreditCard", moduleCode: "oms", screenCode: "oms_condicoes" },

  // --- Preços ---
  { title: "Tabelas de Preço", path: "/dashboard/precos", module: "Preços", icon: "DollarSign", moduleCode: "precos" },
  { title: "Matriz Comparativa", path: "/dashboard/precos/matriz-comparativa", module: "Preços", icon: "Grid3X3", moduleCode: "precos", screenCode: "precos_matriz" },
  { title: "Simulador de Cenários", path: "/dashboard/precos/simulador", module: "Preços", icon: "Sparkles", moduleCode: "precos", screenCode: "precos_simulador" },
];

/**
 * Quick Actions — ações rápidas acessíveis pelo Command Palette
 */
export interface QuickAction {
  title: string;
  path: string;
  icon: string;
  keywords?: string[];
}

export const quickActions: QuickAction[] = [
  { title: "Novo Prospect", path: "/dashboard/prospects/lista?action=new", icon: "Users", keywords: ["criar", "adicionar", "prospect"] },
  { title: "Nova Visita Trade", path: "/dashboard/trade/visits?action=new", icon: "Calendar", keywords: ["criar", "visita"] },
  { title: "Nova Reunião", path: "/dashboard/reunioes?action=new", icon: "Mic", keywords: ["criar", "reuniao"] },
  { title: "Novo Projeto", path: "/dashboard/projetos?action=new", icon: "FolderKanban", keywords: ["criar", "projeto"] },
];
