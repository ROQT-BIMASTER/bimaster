import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface TaskDef {
  nome: string;
  descricao?: string;
  prioridade?: "alta" | "media" | "baixa";
  isBacklog?: boolean;
  subtarefas?: { nome: string; descricao?: string }[];
}

interface SectionDef {
  nome: string;
  tarefas: TaskDef[];
}

interface ProjectDef {
  nome: string;
  cor: string;
  icone: string;
  descricao: string;
  secoes: SectionDef[];
}

function moduleProject(moduleName: string, cor: string, archTasks: TaskDef[], featureTasks: TaskDef[], securityTasks: TaskDef[], backlogTasks: TaskDef[], docTasks: TaskDef[]): ProjectDef {
  return {
    nome: `Módulo: ${moduleName}`,
    cor,
    icone: "FolderKanban",
    descricao: `Documentação técnica completa do módulo ${moduleName} — Arquitetura, funcionalidades, segurança e backlog.`,
    secoes: [
      { nome: "Arquitetura & Fluxos", tarefas: archTasks },
      { nome: "Funcionalidades Implementadas", tarefas: featureTasks },
      { nome: "Segurança do Módulo", tarefas: securityTasks },
      { nome: "Melhorias & Backlog", tarefas: backlogTasks },
      { nome: "Documentação", tarefas: docTasks },
    ],
  };
}

function buildProjects(): ProjectDef[] {
  const projects: ProjectDef[] = [];

  // 1. Arquitetura Geral
  projects.push({
    nome: "Arquitetura Geral — BiMaster",
    cor: "#6366f1",
    icone: "Layers",
    descricao: "Visão geral da arquitetura, stack tecnológico, padrões de código e fluxos de dados do sistema BiMaster.",
    secoes: [
      {
        nome: "Visão Geral",
        tarefas: [
          { nome: "Arquitetura Serverless", descricao: "Frontend React 18 + Vite 5 + Tailwind CSS v3. Backend: Supabase (PostgreSQL + Edge Functions + Auth + Storage + Realtime). Deploy: Lovable Cloud." },
          { nome: "Estrutura de Pastas", descricao: "src/pages — Páginas do sistema (~200 rotas)\nsrc/components — Componentes reutilizáveis por módulo\nsrc/hooks — Custom hooks por domínio\nsrc/contexts — Contextos globais (Auth, Permissions, Theme)\nsrc/lib — Utilitários e constantes\nsupabase/functions — Edge Functions (~30 funções)" },
          { nome: "Modelo Multi-Tenant", descricao: "Empresa única com controle granular por usuário via RBAC + ABAC (user_roles + usuario_permissoes_modulos/telas/componentes)." },
        ],
      },
      {
        nome: "Stack Tecnológico",
        tarefas: [
          { nome: "Frontend Stack", descricao: "React 18.3, TypeScript 5, Vite 5, Tailwind CSS 3, shadcn/ui, Radix UI, Recharts, Framer Motion, TanStack React Query, React Hook Form + Zod, React Router 6, ExcelJS, date-fns." },
          { nome: "Backend Stack", descricao: "Supabase PostgreSQL (RLS nativo), Edge Functions (Deno), Supabase Auth (JWT + MFA), Supabase Storage, Supabase Realtime, Supabase Vault (criptografia)." },
          { nome: "Integrações Externas", descricao: "ERP Omie (API REST), Asana (sync bidirecional), Pluggy (Open Banking), Google Maps, Meta Ads, Google Ads, Google Analytics, ElevenLabs (IA de voz), Stripe (pagamentos)." },
          { nome: "IA & LLMs", descricao: "Gemini 2.5 Pro/Flash para análises financeiras (DRE, Auditoria), classificação contábil, insights de vendas. GPT-5 como fallback. Invocação via Lovable AI proxy (sem API key)." },
        ],
      },
      {
        nome: "Fluxos de Dados",
        tarefas: [
          { nome: "Fluxo de Autenticação", descricao: "Login → Supabase Auth → JWT → PermissionsContext (RPC get_user_permissions_v3) → ModuleScreenRoute guards → Renderização condicional." },
          { nome: "Fluxo ERP → BiMaster", descricao: "Omie Webhook → Edge Function (contas-pagar-webhook) → Validação + Normalização → Upsert em contas_pagar → Sync cadastros (fornecedores, categorias, departamentos, centros de custo)." },
          { nome: "Fluxo de Permissões", descricao: "user_roles → papeis_permissoes → usuario_permissoes (override) → PermissionsContext → useImpersonation → ModuleScreenRoute → UI condicional." },
        ],
      },
      {
        nome: "Padrões de Código",
        tarefas: [
          { nome: "Convenções de Nomenclatura", descricao: "Tabelas: snake_case (português). Componentes: PascalCase. Hooks: camelCase com prefixo 'use'. Edge Functions: kebab-case. Constantes: UPPER_SNAKE_CASE." },
          { nome: "Padrão de Hooks", descricao: "Cada domínio tem seu hook (useProjetos, useContasPagar, useExpenseAI). Hooks encapsulam queries, mutations, invalidações e toasts." },
          { nome: "Padrão de Edge Functions", descricao: "Importações compartilhadas em _shared/ (auth.ts, cors.ts, response.ts, validate.ts). Validação com Zod. CORS lockdown. Rate limiting. Logging estruturado." },
          { nome: "Design System", descricao: "Tokens semânticos HSL em index.css. Cores por variáveis CSS (--primary, --background, etc). Componentes shadcn customizados. Dark mode nativo." },
        ],
      },
      {
        nome: "Integrações Externas",
        tarefas: [
          { nome: "API ERP Omie", descricao: "~15 endpoints mapeados (clientes, fornecedores, contas a pagar/receber, pedidos, produtos, departamentos, centros de custo, categorias, plano de contas). Sync via webhooks e edge functions." },
          { nome: "Asana Sync", descricao: "Importação de projetos, seções, tarefas, subtarefas, colaboradores, comentários e anexos. Mapeamento bidirecional via asana_sync_mappings." },
          { nome: "Open Banking (Pluggy)", descricao: "Conexão bancária, saldo em tempo real, extrato automático, conciliação financeira." },
          { nome: "Google Maps", descricao: "Visualização geográfica de prospects, clientes e lojas. MarkerClusterer para densidade. Rotas otimizadas." },
        ],
      },
    ],
  });

  // 2. Prospects & CRM
  projects.push(moduleProject("Prospects & CRM", "#3b82f6",
    [
      { nome: "Componentes Principais", descricao: "ProspectsOptimized.tsx (listagem virtualizada), ProspectDetailPanel (detalhe lateral), ImportarClientes (import Excel/CSV).", subtarefas: [
        { nome: "Tela: Lista de Prospects", descricao: "Tabela paginada com filtros (status, região, vendedor), busca full-text, exportação Excel." },
        { nome: "Tela: Detalhe do Prospect", descricao: "Panel lateral com dados, atividades, histórico de contatos, geolocalização." },
        { nome: "Tela: Mapa Geográfico", descricao: "Google Maps com clusters, filtros por estado/região, pins coloridos por status." },
      ]},
      { nome: "Hooks e Fluxo de Dados", descricao: "useProspects (query paginada), useAtividades, useVendedores. Dados fluem de prospects → atividades → rankings." },
    ],
    [
      { nome: "Importação Excel/CSV", descricao: "Upload, mapeamento de colunas, validação, preview e inserção em lote com deduplicação por CNPJ." },
      { nome: "Lead Mining & Whitespace", descricao: "Análise de cobertura por município, identificação de áreas sem atendimento, sugestões de prospecção." },
      { nome: "Reativação de Inativos", descricao: "IA identifica prospects inativos com potencial de reativação baseado em histórico e perfil." },
      { nome: "Auditoria de Gôndola", descricao: "Fotos de PDV, análise de posicionamento, comparativo competitivo." },
      { nome: "Brand Share Dashboard", descricao: "Participação de mercado por marca, região e canal. Gráficos comparativos temporais." },
      { nome: "Ranking de Vendedores", descricao: "Performance por vendedor com métricas de visitas, conversões, ticket médio." },
    ],
    [
      { nome: "RLS Policies", descricao: "prospects: SELECT/INSERT/UPDATE via auth.uid() vinculado a vendedor_id ou admin. atividades: vinculadas ao vendedor." },
      { nome: "Route Guards", descricao: "ModuleScreenRoute com moduleCode='prospects'. Tela restrita a admins conforme política de governança." },
    ],
    [
      { nome: "Integração WhatsApp", descricao: "Disparos de mensagem direto do detalhe do prospect via API WhatsApp Business. Inclui templates, tracking de abertura e respostas.", prioridade: "alta", isBacklog: true },
      { nome: "Dashboard de Funil de Conversão", descricao: "Visualização completa do funil prospect → cliente com taxas de conversão por etapa, gargalos e tempo médio em cada fase.", prioridade: "alta", isBacklog: true },
      { nome: "Notificações de Follow-up Automático", descricao: "Sistema de alertas automáticos quando um prospect fica inativo por X dias. Push + email com sugestão de ação.", prioridade: "media", isBacklog: true },
      { nome: "Exportação de Relatórios PDF com Branding", descricao: "Geração de relatórios PDF profissionais com logo da empresa, gráficos e métricas de performance de prospecção.", prioridade: "media", isBacklog: true },
      { nome: "Melhorar Performance de Listagem", descricao: "Implementar virtualização com react-window para >10k prospects. Lazy loading de dados pesados.", prioridade: "baixa", isBacklog: true },
    ],
    [
      { nome: "Documentação Técnica do Módulo", descricao: "Tabelas: prospects, atividades, prospect_fotos, prospect_contatos.\nEdge Functions: export-prospects-api.\nHooks: useProspects, useAtividades.\nPáginas: ProspectsOptimized, Mapa, ImportarClientes, LeadMining, WhitespaceAnalysis, Ranking." },
    ]
  ));

  // 3. Comercial
  projects.push(moduleProject("Comercial", "#10b981",
    [
      { nome: "Componentes Principais", descricao: "Dashboard comercial, mapa de vendas, análise de clientes, projeções.", subtarefas: [
        { nome: "Tela: Dashboard Executivo", descricao: "KPIs de vendas, ticket médio, conversão, pipeline." },
        { nome: "Tela: Mapa Comercial", descricao: "Visualização geográfica de clientes com dados de vendas." },
        { nome: "Tela: Detalhamento de Vendas", descricao: "Drill-down por produto, região, vendedor, período." },
      ]},
    ],
    [
      { nome: "Pipeline de Vendas", descricao: "Kanban de oportunidades com estágios customizáveis." },
      { nome: "Metas & Projeções", descricao: "Definição de metas por vendedor/região, acompanhamento vs realizado, projeção de tendência." },
      { nome: "Performance de Vendas", descricao: "Rankings, comparativos temporais, análise por segmento." },
      { nome: "Análise de Clientes", descricao: "Curva ABC, frequência de compra, risco de churn." },
    ],
    [
      { nome: "RLS Policies", descricao: "Acesso restrito a Ahmad, Ricardo Flausino e Administradores conforme política de governança." },
      { nome: "Route Guards", descricao: "moduleCode='comercial' com verificação adicional de permissão de usuário." },
    ],
    [
      { nome: "Dashboard de Forecast com IA", descricao: "Previsão de vendas com IA baseada em histórico, sazonalidade e tendências de mercado. Modelos de séries temporais.", prioridade: "alta", isBacklog: true },
      { nome: "Comparativo Meta vs Realizado", descricao: "Dashboard com alertas automáticos de desvio. Notificações quando meta está abaixo de X% do esperado para o período.", prioridade: "alta", isBacklog: true },
      { nome: "Integração OMS com Pipeline", descricao: "Conexão de pedidos do sistema OMS com o pipeline de vendas. Atualização automática de status e valores.", prioridade: "media", isBacklog: true },
      { nome: "Curva ABC Dinâmica", descricao: "Classificação ABC de clientes/produtos com atualização em tempo real baseada em dados de vendas recentes.", prioridade: "media", isBacklog: true },
    ],
    [
      { nome: "Documentação Técnica", descricao: "Tabelas: vendas, clientes, metas_projecoes.\nPáginas: DetalhamentoVendas, PerformanceVendas, ComercialMapa, MetasProjecoes." },
    ]
  ));

  // 4. Trade Marketing
  projects.push(moduleProject("Trade Marketing", "#f59e0b",
    [
      { nome: "Componentes Principais", descricao: "Campanhas, visitas PDV, fotos, medições gôndola, sell-out, financeiro trade.", subtarefas: [
        { nome: "Tela: Campanhas", descricao: "CRUD de campanhas com aprovação multi-nível." },
        { nome: "Tela: Visitas", descricao: "Check-in/out com geolocalização, formulário de visita, fotos." },
        { nome: "Tela: Fotos PDV", descricao: "Galeria com categorização, análise de execução." },
        { nome: "Tela: Dashboard Executivo", descricao: "KPIs de execução, cobertura, ROI de campanhas." },
      ]},
    ],
    [
      { nome: "Gestão de Campanhas", descricao: "Criação, aprovação hierárquica (3 níveis), acompanhamento de execução, budget tracking." },
      { nome: "Visitas PDV", descricao: "Agendamento, execução com check-in GPS, formulários dinâmicos, relatório fotográfico." },
      { nome: "Medições de Gôndola", descricao: "Captura de metragem linear, participação por marca, guia de medição visual." },
      { nome: "Sell-Out Analytics", descricao: "Dados de sell-out por loja/rede, tendências, correlação com campanhas." },
      { nome: "Financeiro Trade", descricao: "Verbas semestrais, lançamentos, extratos, contas correntes por rede, conciliação." },
      { nome: "Fotos Ideais", descricao: "Biblioteca de referência de execução ideal por canal/formato de loja." },
      { nome: "Rewards & Gamificação", descricao: "Pontuação por execução, ranking de equipes, recompensas." },
    ],
    [
      { nome: "RLS Policies", descricao: "Campanhas: criação por coordenadores, visualização por equipe. Aprovações: hierarquia definida em trade_approval_levels." },
      { nome: "Route Guards", descricao: "moduleCode='trade'. Sub-telas com screenCodes específicos." },
    ],
    [
      { nome: "IA de Análise de Fotos PDV", descricao: "Classificação automática de qualidade de execução via visão computacional (Gemini Vision). Score de conformidade por foto.", prioridade: "alta", isBacklog: true },
      { nome: "Relatório de ROI por Campanha", descricao: "Cálculo de retorno sobre investimento por campanha com métricas financeiras (verba vs sell-out incremental).", prioridade: "alta", isBacklog: true },
      { nome: "Offline Mode Completo para Visitas", descricao: "PWA com sync offline total: check-in, formulários, fotos. Queue de envio ao reconectar.", prioridade: "media", isBacklog: true },
      { nome: "Dashboard de Cobertura Geográfica", descricao: "Mapas de calor com cobertura de visitas por região, frequência, e gaps de atendimento.", prioridade: "media", isBacklog: true },
    ],
    [
      { nome: "Documentação Técnica", descricao: "Tabelas: trade_campaigns, trade_visits, trade_photos, trade_measurements, trade_sellout, trade_verbas, trade_lancamentos.\nPáginas: ~20 telas de Trade." },
    ]
  ));

  // 5. Financeiro
  projects.push(moduleProject("Financeiro", "#ef4444",
    [
      { nome: "Componentes Principais", descricao: "Contas a Pagar, DRE Gerencial, Fluxo de Caixa, Plano de Redução, Contas a Receber.", subtarefas: [
        { nome: "Tela: Contas a Pagar", descricao: "Lista com filtros, detalhe de lançamento, classificação contábil." },
        { nome: "Tela: DRE Gerencial", descricao: "Demonstrativo com drill-down por fornecedor e departamento." },
        { nome: "Tela: Fluxo de Caixa", descricao: "Projeção temporal, cenários, integração bancária." },
        { nome: "Tela: Plano de Redução", descricao: "Seleção de itens, metas, compartilhamento, auditoria IA." },
        { nome: "Tela: Painel AP Central (Admin)", descricao: "Governança de contas a pagar, fila ERP, conciliação." },
      ]},
      { nome: "Hooks e Fluxo de Dados", descricao: "useContasPagar, useDREData, useFluxoCaixa, useExpenseAI. Dados: ERP → contas_pagar → classificação → DRE → análises." },
    ],
    [
      { nome: "Contas a Pagar (AP)", descricao: "Importação automática do ERP, classificação contábil (manual + IA), aprovação, conciliação bancária.", subtarefas: [
        { nome: "Painel Central AP (Admin)", descricao: "Visão consolidada de todos os pagamentos pendentes, aprovados e processados." },
        { nome: "Fila de Exportação ERP", descricao: "Gestão de lançamentos pendentes de envio ao ERP." },
        { nome: "Conciliação Manual", descricao: "Match entre extrato bancário e lançamentos do sistema." },
        { nome: "Sync Cadastros", descricao: "Sincronização de fornecedores, categorias, departamentos e centros de custo com ERP." },
      ]},
      { nome: "DRE Gerencial", descricao: "Classificação por plano de contas, análise vertical/horizontal, drill-down por fornecedor e departamento com gráficos profissionais.", subtarefas: [
        { nome: "Classificação Contábil", descricao: "Mapeamento de lançamentos para plano de contas com sugestão IA." },
        { nome: "Drill-down por Fornecedor", descricao: "Detalhamento de gastos por fornecedor com timeline e KPIs." },
        { nome: "Drill-down por Departamento", descricao: "Detalhamento de gastos por departamento com comparativos." },
      ]},
      { nome: "Fluxo de Caixa", descricao: "Projeção de entradas e saídas, cenários otimista/pessimista, integração com saldos bancários (Pluggy)." },
      { nome: "Plano de Redução de Gastos", descricao: "Criação de planos com metas por fornecedor, compartilhamento entre usuários, auditoria IA com análise de anomalias.", subtarefas: [
        { nome: "Criação e Gestão de Planos", descricao: "CRUD com propriedade por usuário (criado_por)." },
        { nome: "Compartilhamento", descricao: "Liberação de acesso a outros usuários via planos_reducao_compartilhados." },
        { nome: "Auditoria IA Premium", descricao: "Análise de anomalias com Gemini 2.5 Pro: radar de risco, tendências temporais, recomendações estratégicas." },
      ]},
      { nome: "Integração ERP (Omie)", descricao: "Webhooks para recebimento automático, APIs para consulta e envio. Mapeamento contábil bidirecional." },
      { nome: "Contas a Receber", descricao: "Gestão de recebíveis, boletos, inadimplência, aging report." },
    ],
    [
      { nome: "RLS Policies", descricao: "contas_pagar: acesso por authenticated. Telas admin (Painel AP, Fila ERP, Sync, Conciliação): requireAdmin=true + screenCode='admin'." },
      { nome: "Route Guards", descricao: "moduleCode='financeiro'. Sub-telas com ScreenRoute individual. Telas admin com requireAdmin flag." },
      { nome: "Edge Functions", descricao: "contas-pagar-webhook, contas-pagar-api, expense-ai-assistant, export-ap-erp. Todas com validação Zod + CORS lockdown." },
      { nome: "Histórico e Auditoria", descricao: "contas_pagar_historico: registra todas as alterações de classificação. Trigger automático de auditoria em contas_pagar." },
    ],
    [
      { nome: "Aprovação de Pagamentos Multi-Nível", descricao: "Workflow de aprovação hierárquica para pagamentos acima de thresholds configuráveis. Alçadas por valor e departamento.", prioridade: "alta", isBacklog: true },
      { nome: "Conciliação Bancária Automática", descricao: "Match automático entre extrato bancário (Pluggy) e lançamentos do sistema por valor + data + fornecedor.", prioridade: "alta", isBacklog: true },
      { nome: "Alertas de Vencimento por Email/Push", descricao: "Sistema de notificações proativas para pagamentos próximos do vencimento. Configurável por antecedência.", prioridade: "media", isBacklog: true },
      { nome: "Dashboard Financeiro Consolidado", descricao: "Visão unificada de AP + AR + DRE + Fluxo de Caixa em tela única com KPIs cruzados.", prioridade: "media", isBacklog: true },
      { nome: "Previsão de Fluxo de Caixa com IA", descricao: "Projeção inteligente baseada em histórico de pagamentos, sazonalidade e compromissos futuros. Cenários automáticos.", prioridade: "alta", isBacklog: true },
    ],
    [
      { nome: "Documentação Técnica", descricao: "Tabelas: contas_pagar, contas_receber, contas_pagar_historico, contas_pagar_revisao, planos_reducao, planos_reducao_compartilhados, fornecedores, departamentos, centros_custo, plano_contas, boletos, bank_connections.\nEdge Functions: contas-pagar-webhook, contas-pagar-api, expense-ai-assistant.\nHooks: useContasPagar, useDREData, useFluxoCaixa, useExpenseAI.\nPáginas: ContasAPagar, DREAnalitico, FluxoDeCaixa, PlanoReducao, ContasAReceber, SaldosBancarios + 6 telas admin." },
    ]
  ));

  // 6. Fábrica Brasil
  projects.push(moduleProject("Fábrica Brasil", "#8b5cf6",
    [
      { nome: "Componentes Principais", descricao: "Produtos acabados, matérias-primas, fórmulas, ordens de produção, qualidade, máquinas, operadores.", subtarefas: [
        { nome: "Tela: Produtos Acabados", descricao: "Cadastro com ficha técnica, custos, embalagem." },
        { nome: "Tela: Matérias-Primas", descricao: "Gestão de insumos com estoque e fornecedores." },
        { nome: "Tela: Fórmulas", descricao: "Editor de composição com cálculo automático de custo." },
        { nome: "Tela: Ordens de Produção", descricao: "Planejamento, apontamentos, controle de qualidade." },
      ]},
    ],
    [
      { nome: "Gestão de Produtos Acabados", descricao: "Cadastro completo, ficha de custo, importação em lote." },
      { nome: "Editor de Fórmulas", descricao: "Composição de produtos com matérias-primas, cálculo de custo por unidade." },
      { nome: "Ordens de Produção", descricao: "Planejamento, execução, apontamentos de produção, paradas." },
      { nome: "Controle de Qualidade", descricao: "Inspeções, laudos, rastreabilidade de lotes." },
      { nome: "Tabelas de Preço", descricao: "Gestão de preços por canal/região, simulador de cenários, aprovação de alterações." },
      { nome: "Dashboard Executivo", descricao: "KPIs de produção, eficiência, custos, qualidade." },
      { nome: "Gestão Fiscal", descricao: "Tabela de impostos, NCM, regras fiscais por estado." },
    ],
    [
      { nome: "RLS Policies", descricao: "Acesso por authenticated com restrição por módulo. Preços: gestão de visibilidade por usuário (config_fornecedor_visibilidade)." },
      { nome: "Route Guards", descricao: "moduleCode='fabrica'. Sub-telas com screenCodes individuais." },
    ],
    [
      { nome: "Integração OP com ERP (Bidirecional)", descricao: "Sync bidirecional de ordens de produção e apontamentos com ERP Omie. Atualização de status em tempo real.", prioridade: "alta", isBacklog: true },
      { nome: "Dashboard de OEE", descricao: "Eficiência Global de Equipamento: Disponibilidade × Performance × Qualidade. Gráficos por máquina e turno.", prioridade: "alta", isBacklog: true },
      { nome: "Alertas de Estoque Mínimo de MP", descricao: "Monitoramento contínuo de matérias-primas com alertas quando atingem nível crítico. Sugestão de compra automática.", prioridade: "media", isBacklog: true },
      { nome: "Rastreabilidade de Lote Ponta-a-Ponta", descricao: "Tracking completo: MP recebida → Fórmula → OP → Lote → Expedição. Consulta reversa por lote.", prioridade: "media", isBacklog: true },
      { nome: "Comparativo Custo Planejado vs Real", descricao: "Análise de variação entre custo previsto na fórmula e custo real da produção por OP.", prioridade: "baixa", isBacklog: true },
    ],
    [
      { nome: "Documentação Técnica", descricao: "Tabelas: produtos_acabados, materias_primas, formulas, formula_itens, ordens_producao, apontamentos, qualidade_inspecoes, tabelas_preco.\nPáginas: ~15 telas de Fábrica." },
    ]
  ));

  // 7. Fábrica China
  projects.push(moduleProject("Fábrica China", "#ec4899",
    [
      { nome: "Componentes Principais", descricao: "Submissões de produto, checklist por fluxo, revisão documental, chat contextual, cofre de produto.", subtarefas: [
        { nome: "Tela: Nova Submissão", descricao: "Formulário multi-step com dados do produto, fornecedor, especificações." },
        { nome: "Tela: Detalhe da Submissão", descricao: "Abas: Checklist, Chat, Revisões, Cofre, Timeline." },
        { nome: "Tela: Ordens de Compra", descricao: "Gestão de POs com tracking de status." },
        { nome: "Tela: Recebimentos", descricao: "Registro de chegada, conferência de qualidade." },
      ]},
    ],
    [
      { nome: "Fluxo de Submissão", descricao: "Novo produto → Checklist por categoria → Revisão documental (rodadas) → Aprovação → Cofre oficial." },
      { nome: "Checklist por Fluxo", descricao: "Categorias padrão + customizáveis. Upload de documentos com versionamento. Campos texto, arquivo, múltiplos." },
      { nome: "Revisão Documental", descricao: "Revisão por rodadas com aprovar/rejeitar/contestar. Anotações visuais. Histórico completo." },
      { nome: "Chat Contextual", descricao: "Mensagens vinculadas a itens específicos do checklist. Menções, anexos, respostas." },
      { nome: "Cofre do Produto", descricao: "Documentos oficiais aprovados. 5 itens obrigatórios iniciais. Auto-link de aprovados ao cofre." },
      { nome: "Matriz de Permissões", descricao: "ABAC por etapa e campo: controle granular do que China e Brasil podem ver/editar por fase." },
    ],
    [
      { nome: "RLS Policies", descricao: "Submissões: acesso por membros do projeto. Revisões: restritas a revisores autorizados. Cofre: exclusão bloqueada." },
      { nome: "Permissões ABAC", descricao: "process_field_permissions: controle por etapa × campo × equipe (China/Brasil)." },
      { nome: "Route Guards", descricao: "moduleCode='china'. Sub-telas com screenCodes." },
    ],
    [
      { nome: "Notificações WeChat para Revisão", descricao: "Alertas via WeChat API quando documentos precisam de revisão pela equipe China. Template em mandarim.", prioridade: "alta", isBacklog: true },
      { nome: "Dashboard de Lead Time por Fornecedor", descricao: "Análise de tempo médio de entrega por fornecedor chinês. Comparativo e ranking de performance.", prioridade: "media", isBacklog: true },
      { nome: "Automação de Emissão de PO", descricao: "Geração automática de PO a partir de submissão aprovada com dados pré-preenchidos do fornecedor e produto.", prioridade: "alta", isBacklog: true },
      { nome: "Relatório de Conformidade Documental", descricao: "Score de conformidade por fornecedor baseado em taxa de aprovação, rodadas de revisão e tempo de resposta.", prioridade: "media", isBacklog: true },
    ],
    [
      { nome: "Documentação Técnica", descricao: "Tabelas: china_produto_submissoes, china_checklist_*, china_doc_revisoes, china_chat_mensagens, china_cofre_produto, china_categoria_responsaveis, process_field_permissions.\nPáginas: ChinaFabrica, ChinaNovaSubmissao, ChinaSubmissaoDetalhe, ChinaOrdens, ChinaRecebimentos." },
    ]
  ));

  // 8. Marketing
  projects.push(moduleProject("Marketing", "#06b6d4",
    [
      { nome: "Componentes Principais", descricao: "Dashboard de campanhas digitais, métricas de ads, analytics, mission control.", subtarefas: [
        { nome: "Tela: Dashboard Marketing", descricao: "Visão consolidada de métricas de todas as plataformas." },
        { nome: "Tela: Mission Control", descricao: "Painel operacional de campanhas ativas." },
      ]},
    ],
    [
      { nome: "Integração Meta Ads", descricao: "Sync de campanhas, métricas diárias, análise de performance." },
      { nome: "Integração Google Ads", descricao: "Importação de dados de campanhas, custo, conversões." },
      { nome: "Google Analytics", descricao: "Métricas de tráfego, comportamento, conversões do site." },
      { nome: "Mission Control", descricao: "Painel unificado de todas as campanhas ativas com KPIs em tempo real." },
      { nome: "Fluxo de Aprovação de Artes", descricao: "Submissão → Revisão → Aprovação com versionamento e comentários." },
    ],
    [
      { nome: "RLS Policies", descricao: "ads_accounts: acesso por user_id. Credenciais criptografadas via Supabase Vault." },
      { nome: "Criptografia OAuth", descricao: "Tokens de integração criptografados server-side com pgcrypto + Vault. Decriptação sob demanda via RPC." },
    ],
    [
      { nome: "IA de Otimização de Budget", descricao: "Sugestões automáticas de redistribuição de budget entre plataformas baseadas em performance (ROAS, CPA, CPC).", prioridade: "alta", isBacklog: true },
      { nome: "A/B Testing Tracker Integrado", descricao: "Módulo de acompanhamento de testes A/B com significância estatística, winner detection e histórico.", prioridade: "media", isBacklog: true },
      { nome: "Relatório Consolidado Cross-Platform", descricao: "Dashboard unificado Meta Ads + Google Ads + Analytics com métricas normalizadas e atribuição multi-touch.", prioridade: "alta", isBacklog: true },
      { nome: "Calendário Editorial com Agendamento", descricao: "Automação de agendamento de posts com calendário visual, aprovação e integração com plataformas.", prioridade: "baixa", isBacklog: true },
    ],
    [
      { nome: "Documentação Técnica", descricao: "Tabelas: ads_accounts, ads_campaigns, ads_metrics, ads_campaign_metrics, analytics_metrics, social_media_credentials.\nPáginas: Marketing, MarketingMissionControl, FluxoAprovacaoArtes." },
    ]
  ));

  // 9. Projetos
  projects.push(moduleProject("Projetos", "#6366f1",
    [
      { nome: "Componentes Principais", descricao: "Lista de projetos, detalhe (Lista/Kanban/Cronograma/Calendário), ambiente pessoal, inbox.", subtarefas: [
        { nome: "Tela: Lista de Projetos", descricao: "Tabela com métricas, membros, progresso." },
        { nome: "Tela: Detalhe do Projeto", descricao: "5 visões: Lista estilo planilha, Kanban, Cronograma, Calendário, Arquivos." },
        { nome: "Tela: Home Pessoal", descricao: "Dashboard individual com KPIs e quick actions." },
        { nome: "Tela: Minhas Tarefas", descricao: "Lista/Quadro/Calendário das tarefas do usuário." },
        { nome: "Tela: Inbox", descricao: "Notificações com split-view e ações em lote." },
      ]},
      { nome: "Hooks e Fluxo de Dados", descricao: "useProjetos, useProjetoTarefas, useMinhasTarefas. RPC: get_projeto_metrics, get_projetos_member_avatars." },
    ],
    [
      { nome: "Gestão de Tarefas", descricao: "CRUD completo, subtarefas, dependências, tags, prioridades, prazos, responsáveis, colaboradores." },
      { nome: "Visão Kanban", descricao: "Drag-and-drop com @dnd-kit, agrupamento por seção/status/prioridade." },
      { nome: "Visão Cronograma", descricao: "Timeline horizontal com barras de duração, dependências visuais." },
      { nome: "Cofre Oficial de Documentos", descricao: "Versionamento formal com aprovação. Admin do cofre com autoridade exclusiva." },
      { nome: "Colunas Configuráveis", descricao: "Personalização de colunas visíveis com persistência local por projeto." },
      { nome: "Vinculação com Módulos", descricao: "modulo_projeto_vinculos: link bidirecional entre tarefas e registros de módulos (Composição, Amostras, etc)." },
      { nome: "Criação de Tarefas com IA", descricao: "Dialog que gera tarefas estruturadas a partir de briefing textual." },
      { nome: "Visibilidade por Seção", descricao: "Membros podem ter acesso restrito a seções específicas do projeto." },
    ],
    [
      { nome: "RLS Policies", descricao: "Funções SECURITY DEFINER: user_can_access_projeto(), user_can_access_projeto_via_tarefa(). 13+ tabelas auxiliares protegidas." },
      { nome: "Auditoria de Tarefas", descricao: "Trigger audit_projeto_tarefa_changes registra todas as transações em projeto_tarefa_atividades." },
      { nome: "Anti Self-Join", descricao: "Correção de vulnerabilidade em projeto_membros que permitia auto-atribuição de coordenador." },
    ],
    [
      { nome: "Templates Customizáveis pelo Usuário", descricao: "Permitir criação e gestão de templates de projeto personalizados com seções, tarefas e campos pré-definidos.", prioridade: "alta", isBacklog: true },
      { nome: "Dependências entre Tarefas", descricao: "Sistema de predecessoras/sucessoras com validação de datas e visualização no cronograma (Gantt).", prioridade: "alta", isBacklog: true },
      { nome: "Relatório de Produtividade por Membro", descricao: "Dashboard de performance individual: tarefas concluídas, tempo médio, taxa de atraso, burndown pessoal.", prioridade: "media", isBacklog: true },
      { nome: "Automação de Status por Regras", descricao: "Regras automáticas: todas subtarefas concluídas → tarefa pai concluída. Configurável por projeto.", prioridade: "media", isBacklog: true },
      { nome: "Burndown Chart por Sprint", descricao: "Gráfico de burndown/burnup por período configurável com linha ideal e velocidade da equipe.", prioridade: "baixa", isBacklog: true },
    ],
    [
      { nome: "Documentação Técnica", descricao: "Tabelas: projetos, projeto_membros, projeto_secoes, projeto_tarefas, projeto_tarefa_*, projeto_metas, projeto_tags, projeto_docs_cofre.\nHooks: useProjetos, useProjetoTarefas, useMinhasTarefas.\nPáginas: Projetos, ProjetoDetalhe, ProjetoHome, MinhasTarefas, ProjetoInbox.\nConstantes: projetoConstants.ts." },
    ]
  ));

  // 10. Estoque
  projects.push(moduleProject("Estoque", "#f59e0b",
    [
      { nome: "Componentes Principais", descricao: "Saldos, consolidado, distribuidoras, vinculações de produto.", subtarefas: [
        { nome: "Tela: Saldos", descricao: "Estoque atual por produto/local." },
        { nome: "Tela: Consolidado", descricao: "Visão agregada por categoria/marca." },
        { nome: "Tela: Distribuidoras", descricao: "Estoque por distribuidora." },
      ]},
    ],
    [
      { nome: "Gestão de Saldos", descricao: "Consulta de estoque por produto, localização e lote." },
      { nome: "Consolidado por Categoria", descricao: "Agregação de estoque por marca, categoria e tipo." },
      { nome: "Vinculações de Produto", descricao: "Mapeamento entre códigos ERP e produtos do sistema." },
      { nome: "Produtos Master", descricao: "Cadastro unificado de produtos com hierarquia (marca → linha → SKU)." },
    ],
    [
      { nome: "RLS Policies", descricao: "Acesso por authenticated com moduleCode='estoque'." },
    ],
    [
      { nome: "Alertas de Estoque Mínimo/Máximo", descricao: "Notificações automáticas quando estoque atinge nível crítico (mínimo) ou excede capacidade (máximo) por produto.", prioridade: "alta", isBacklog: true },
      { nome: "Dashboard de Giro de Estoque", descricao: "Análise de rotatividade por produto/categoria com indicadores de cobertura em dias e produtos parados.", prioridade: "alta", isBacklog: true },
      { nome: "Integração de Movimentações com ERP", descricao: "Sync automático de entradas, saídas e transferências de estoque com sistema ERP.", prioridade: "media", isBacklog: true },
      { nome: "Inventário com Código de Barras", descricao: "Módulo de inventário com leitura de código de barras via câmera do celular. Contagem e ajuste automatizado.", prioridade: "baixa", isBacklog: true },
    ],
    [
      { nome: "Documentação Técnica", descricao: "Tabelas: estoque_saldos, estoque_movimentacoes, produtos_master.\nPáginas: EstoqueSaldos, EstoqueConsolidado, EstoqueDistribuidoras, EstoqueVinculacoes, EstoqueProdutosMaster." },
    ]
  ));

  // 11. Eventos
  projects.push(moduleProject("Eventos", "#ec4899",
    [
      { nome: "Componentes Principais", descricao: "Calendário de eventos, detalhe, dashboard, aprovações.", subtarefas: [
        { nome: "Tela: Lista de Eventos", descricao: "Calendário e lista de eventos corporativos." },
        { nome: "Tela: Detalhe do Evento", descricao: "Informações, participantes, budget, documentos." },
        { nome: "Tela: Dashboard", descricao: "KPIs de eventos, gastos, participação." },
      ]},
    ],
    [
      { nome: "Gestão de Eventos Corporativos", descricao: "Criação, planejamento, orçamento, convidados." },
      { nome: "Dashboard de Eventos", descricao: "Métricas de participação, custos, ROI." },
      { nome: "Aprovação de Eventos", descricao: "Workflow de aprovação para novos eventos e orçamentos." },
    ],
    [
      { nome: "RLS Policies", descricao: "Acesso por authenticated com moduleCode='eventos'." },
    ],
    [
      { nome: "Integração Google Calendar / Outlook", descricao: "Sync bidirecional de eventos corporativos com Google Calendar e Microsoft Outlook.", prioridade: "alta", isBacklog: true },
      { nome: "Dashboard de ROI por Evento", descricao: "Cálculo de retorno sobre investimento por evento com métricas de custo, participação e resultados.", prioridade: "media", isBacklog: true },
      { nome: "Check-in Digital com QR Code", descricao: "Geração de QR codes únicos por participante. Check-in via câmera com confirmação em tempo real.", prioridade: "media", isBacklog: true },
      { nome: "Gestão de Fornecedores do Evento", descricao: "Cadastro de fornecedores por evento, contratos, pagamentos e avaliações pós-evento.", prioridade: "baixa", isBacklog: true },
    ],
    [
      { nome: "Documentação Técnica", descricao: "Tabelas: corporate_events, event_participants, event_budgets.\nPáginas: CorporateEvents, CorporateEventDetail, CorporateEventsDashboard." },
    ]
  ));

  // 12. Reuniões
  projects.push(moduleProject("Reuniões", "#10b981",
    [
      { nome: "Componentes Principais", descricao: "Lista de reuniões, detalhe com ata, participantes, action items.", subtarefas: [
        { nome: "Tela: Lista de Reuniões", descricao: "Calendário e lista com filtros." },
        { nome: "Tela: Detalhe da Reunião", descricao: "Ata, participantes, deliberações, tarefas geradas." },
      ]},
    ],
    [
      { nome: "Gestão de Reuniões", descricao: "Agendamento, pauta, ata colaborativa, deliberações." },
      { nome: "Action Items", descricao: "Tarefas geradas a partir de deliberações, vinculadas a projetos." },
      { nome: "Histórico de Atas", descricao: "Arquivo de todas as atas com busca full-text." },
    ],
    [
      { nome: "RLS Policies", descricao: "Acesso por participantes da reunião ou admin." },
    ],
    [
      { nome: "Transcrição Automática de Áudio com IA", descricao: "Transcrição de áudio/vídeo da reunião usando Gemini/Whisper. Identificação de speakers.", prioridade: "alta", isBacklog: true },
      { nome: "Resumo Automático e Action Items", descricao: "IA gera resumo executivo da reunião e extrai action items automaticamente com responsáveis sugeridos.", prioridade: "alta", isBacklog: true },
      { nome: "Integração Google Meet / Zoom", descricao: "Conectar com plataformas de videoconferência para gravação automática e importação de participantes.", prioridade: "media", isBacklog: true },
      { nome: "Busca Semântica em Atas", descricao: "Busca inteligente em atas anteriores por tema/assunto usando embeddings. Recuperação de decisões passadas.", prioridade: "baixa", isBacklog: true },
    ],
    [
      { nome: "Documentação Técnica", descricao: "Tabelas: reunioes, reuniao_participantes, reuniao_deliberacoes, reuniao_atas.\nPáginas: Reunioes, ReuniaoDetalhe." },
    ]
  ));

  // 13. Integração ERP
  projects.push(moduleProject("Integração ERP", "#3b82f6",
    [
      { nome: "Componentes Principais", descricao: "Portal de APIs, configuração de integração, logs, health check.", subtarefas: [
        { nome: "Tela: Portal ERP (Huggs)", descricao: "Documentação interativa de APIs, testes, mensagens de suporte." },
        { nome: "Tela: Health Check", descricao: "Status de todas as integrações em tempo real." },
        { nome: "Tela: Relatório de APIs", descricao: "Logs de chamadas, erros, latência." },
      ]},
    ],
    [
      { nome: "API Huggs (Portal)", descricao: "Portal de integração com documentação interativa, geração de API keys, testes inline, mensagens de suporte." },
      { nome: "Webhooks ERP", descricao: "Recebimento automático de dados do ERP (contas a pagar, clientes, fornecedores, pedidos, produtos)." },
      { nome: "APIs REST", descricao: "Endpoints de consulta, inclusão, alteração e exclusão para cada entidade (clientes, projetos, etc).", subtarefas: [
        { nome: "API Clientes", descricao: "CRUD + upsert de clientes com mapeamento Huggs." },
        { nome: "API Projetos", descricao: "CRUD + upsert de projetos com mapeamento codInt." },
        { nome: "API Contas a Pagar", descricao: "Webhook de inclusão/alteração com normalização." },
      ]},
      { nome: "Sync de Cadastros", descricao: "Sincronização periódica de fornecedores, categorias, departamentos, centros de custo, plano de contas." },
      { nome: "Rate Limiting", descricao: "Controle de taxa por IP/API key via tabela api_rate_limit. Throttling progressivo." },
      { nome: "Rotação de Chaves", descricao: "Rotação de API keys com período de graça (api_key_anterior + expiração). Hash SHA-256 para armazenamento." },
    ],
    [
      { nome: "Autenticação x-api-key", descricao: "Validação timing-safe contra erp_config e erp_api_keys. Suporte a hash + plaintext + chave anterior." },
      { nome: "Validação de Input", descricao: "Zod schemas em todas as edge functions. Sanitização de strings." },
      { nome: "CORS Lockdown", descricao: "Whitelist de origens. Rejeição de origens não autorizadas." },
      { nome: "Security Headers", descricao: "CSP, X-Frame-Options, X-Content-Type-Options em todas as respostas." },
    ],
    [
      { nome: "Retry Automático para Webhooks", descricao: "Sistema de retry com backoff exponencial para webhooks que falharam. Fila de dead-letter com investigação.", prioridade: "alta", isBacklog: true },
      { nome: "Dashboard de Saúde das Integrações", descricao: "Painel em tempo real com status de cada integração, alertas de falha, latência e uptime.", prioridade: "alta", isBacklog: true },
      { nome: "Logs de Sync com Drill-down", descricao: "Logs detalhados de sincronização por entidade com filtros, drill-down e exportação.", prioridade: "media", isBacklog: true },
      { nome: "Documentação Interativa Auto-Gerada", descricao: "OpenAPI/Swagger gerado automaticamente a partir dos schemas das edge functions. Testes inline.", prioridade: "baixa", isBacklog: true },
    ],
    [
      { nome: "Documentação Técnica", descricao: "Tabelas: erp_config, erp_api_keys, api_rate_limit, api_security_log, api_access_log.\nEdge Functions: contas-pagar-webhook, contas-pagar-api, clientes-api, projetos-api, export-ap-erp, sync-omie-*.\nDocs: API_CLIENTES.md, API_PROJETOS.md." },
    ]
  ));

  // 14. Central de Inteligência
  projects.push(moduleProject("Central de Inteligência", "#8b5cf6",
    [
      { nome: "Componentes Principais", descricao: "Dashboard executivo, insights IA, análise municipal, simulação de dados.", subtarefas: [
        { nome: "Tela: Dashboard IA", descricao: "Insights gerados por IA com priorização por impacto." },
        { nome: "Tela: Análise Municipal", descricao: "Dados IBGE + correlação com vendas." },
        { nome: "Tela: Market Intelligence", descricao: "Análise competitiva e tendências de mercado." },
      ]},
    ],
    [
      { nome: "AI Insights", descricao: "Geração automática de insights com classificação por categoria, impacto e confiança." },
      { nome: "Análise Municipal (IBGE)", descricao: "Dados demográficos e econômicos por município, correlação com performance de vendas." },
      { nome: "Market Intelligence", descricao: "Análise competitiva, tendências de mercado, oportunidades." },
      { nome: "Simulação de Dados", descricao: "Geração de dados para teste e validação de dashboards." },
      { nome: "AI Calls", descricao: "Ligações automatizadas com IA (ElevenLabs) para qualificação de prospects." },
    ],
    [
      { nome: "Acesso Restrito", descricao: "Módulo oculto por padrão. Requer permissão explícita de módulo (central_inteligencia)." },
    ],
    [
      { nome: "Alertas Proativos de Insights Críticos", descricao: "Notificações push/email quando IA detecta anomalias críticas ou oportunidades de alto impacto.", prioridade: "alta", isBacklog: true },
      { nome: "Dashboard Preditivo com Séries Temporais", descricao: "Projeções baseadas em modelos de séries temporais para vendas, estoque e financeiro.", prioridade: "alta", isBacklog: true },
      { nome: "Correlação Automática entre Módulos", descricao: "Cruzamento inteligente: vendas × estoque × produção × financeiro. Identificação de padrões ocultos.", prioridade: "media", isBacklog: true },
      { nome: "Exportação de Relatórios Executivos em PDF", descricao: "Relatórios IA formatados para diretoria com gráficos, insights e recomendações estratégicas.", prioridade: "media", isBacklog: true },
    ],
    [
      { nome: "Documentação Técnica", descricao: "Tabelas: ai_insights, ai_calls, ai_call_transcriptions, ai_call_actions, agg_daily_kpis.\nPáginas: AIAnalytics, MarketIntelligence, MunicipiosIntelligence, SimulacaoDados." },
    ]
  ));

  // 15. Segurança Global
  projects.push({
    nome: "Segurança Global — BiMaster",
    cor: "#ef4444",
    icone: "Shield",
    descricao: "Documentação completa de segurança do sistema BiMaster — Autenticação, autorização, proteção de borda, auditoria, LGPD e monitoramento.",
    secoes: [
      {
        nome: "Autenticação",
        tarefas: [
          { nome: "JWT + Refresh Automático", descricao: "Supabase Auth com JWT. Refresh automático via onAuthStateChange. Token incluído em todas as chamadas a Edge Functions." },
          { nome: "MFA/TOTP", descricao: "Autenticação multi-fator com TOTP (Time-based One-Time Password). Configuração por usuário." },
          { nome: "Account Lockout", descricao: "Bloqueio automático após N tentativas falhas. Desbloqueio por admin." },
          { nome: "Aprovação Manual de Usuários", descricao: "Novos cadastros aguardam aprovação de admin antes de acessar o sistema (tela AguardandoAprovacao)." },
          { nome: "Recuperação de Senha", descricao: "Fluxo seguro de reset via email com token temporário." },
        ],
      },
      {
        nome: "Autorização (RLS)",
        tarefas: [
          { nome: "Modelo RBAC + ABAC", descricao: "Roles (admin, supervisor, vendedor) + permissões granulares por módulo, tela e componente. Override exclusivo por usuário." },
          { nome: "513 Tabelas Protegidas", descricao: "Revisão completa de RLS em todas as tabelas. Exclusão de acesso 'public'. Operações admin requerem role adequada." },
          { nome: "Funções SECURITY DEFINER", descricao: "search_path = public para prevenir hijacking. Funções: user_can_access_projeto, has_role, get_user_permissions_v3." },
          { nome: "Impersonação Segura", descricao: "Apenas admins podem impersonar. Contexto separado (ImpersonationContext). Restauração apenas pelo mesmo admin." },
        ],
      },
      {
        nome: "WAF & Edge",
        tarefas: [
          { nome: "CORS Lockdown", descricao: "Whitelist de origens (bimaster.lovable.app + preview). Regex para subdomínios lovable. Server-to-server sem origin permitido." },
          { nome: "CSP + Security Headers", descricao: "Content-Security-Policy, X-Frame-Options: DENY, X-Content-Type-Options: nosniff em todas as respostas." },
          { nome: "Rate Limiting L7", descricao: "Throttling progressivo por IP/API key via api_rate_limit. Janelas de 1min/15min/1h." },
          { nome: "Validação de Input (Zod)", descricao: "Schemas Zod em todas as edge functions. Sanitização de strings (controle de chars, limite de tamanho)." },
          { nome: "Timing-Safe Comparison", descricao: "Comparação de API keys e HMAC com tempo constante para prevenir timing attacks." },
        ],
      },
      {
        nome: "Auditoria",
        tarefas: [
          { nome: "Audit Logs Centralizados", descricao: "audit_logs + audit_logs_archive: registra ações com old_data/new_data, IP, user_agent." },
          { nome: "Access Audit Log", descricao: "access_audit_log: monitora acessos a módulos e telas com sucesso/falha." },
          { nome: "Security Audit Log", descricao: "security_audit_log: eventos de segurança (login, MFA, lockout, export, permission change)." },
          { nome: "API Security Log", descricao: "api_security_log: registra todas as chamadas de API com endpoint, método, IP, tempo de resposta." },
          { nome: "Histórico de Alterações", descricao: "Triggers de auditoria em tabelas críticas (contas_pagar, projeto_tarefas) com snapshots completos." },
        ],
      },
      {
        nome: "LGPD",
        tarefas: [
          { nome: "Painel LGPD Admin", descricao: "Interface para gestão de consentimentos, solicitações de exclusão e portabilidade." },
          { nome: "Termos de Uso", descricao: "Página de termos com versionamento e aceite registrado." },
          { nome: "Política de Privacidade", descricao: "Página acessível publicamente com detalhes do tratamento de dados." },
          { nome: "Anonimização de Dados", descricao: "Processo para anonimizar dados pessoais em caso de solicitação." },
        ],
      },
      {
        nome: "Monitoramento",
        tarefas: [
          { nome: "Security Dashboard", descricao: "Painel em tempo real com eventos de segurança, tentativas de acesso, anomalias." },
          { nome: "Security Event Explorer", descricao: "Ferramenta de investigação com filtros avançados por tipo, período, usuário." },
          { nome: "Relatório de Segurança", descricao: "Relatório exportável com métricas de segurança, vulnerabilidades, ações tomadas." },
          { nome: "Rotação de Secrets", descricao: "Cronograma de rotação via secret_rotation_schedule. Alertas de expiração." },
          { nome: "Criptografia de Tokens", descricao: "Supabase Vault + pgcrypto para tokens OAuth. Decriptação sob demanda via RPC." },
        ],
      },
    ],
  });

  return projects;
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();

  try {
    if (req.method !== "POST") {
      return errorResponse(405, "METHOD_NOT_ALLOWED", "Use POST", req, startMs);
    }

    // Auth: get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(401, "UNAUTHORIZED", "Token ausente", req, startMs);
    }

    const token = authHeader.replace("Bearer ", "");
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return errorResponse(401, "UNAUTHORIZED", "Token inválido", req, startMs);
    }

    const userId = userData.user.id;

    // Check admin role
    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return errorResponse(403, "FORBIDDEN", "Apenas administradores podem executar esta ação", req, startMs);
    }

    const projects = buildProjects();
    const results: { nome: string; id: string; secoes: number; tarefas: number }[] = [];

    for (const proj of projects) {
      // Create project
      const { data: projData, error: projErr } = await admin
        .from("projetos")
        .insert({
          nome: proj.nome,
          cor: proj.cor,
          icone: proj.icone,
          descricao: proj.descricao,
          criador_id: userId,
          visibilidade: "privado",
          tipo: "documentacao",
        })
        .select("id")
        .single();

      if (projErr) {
        console.error(`Error creating project ${proj.nome}:`, projErr);
        continue;
      }

      const projetoId = projData.id;

      // Add user as coordenador
      await admin.from("projeto_membros").insert({
        projeto_id: projetoId,
        user_id: userId,
        papel: "coordenador",
      });

      let totalTarefas = 0;

      // Create sections and tasks
      for (let si = 0; si < proj.secoes.length; si++) {
        const secao = proj.secoes[si];

        const { data: secData, error: secErr } = await admin
          .from("projeto_secoes")
          .insert({
            projeto_id: projetoId,
            nome: secao.nome,
            ordem: si,
          })
          .select("id")
          .single();

        if (secErr) {
          console.error(`Error creating section ${secao.nome}:`, secErr);
          continue;
        }

        const secaoId = secData.id;

        for (let ti = 0; ti < secao.tarefas.length; ti++) {
          const tarefa = secao.tarefas[ti];

          // Calculate deadline for backlog tasks
          const now = Date.now();
          const dayMs = 24 * 60 * 60 * 1000;
          let dataPrazo: string | null = null;
          if (tarefa.isBacklog && tarefa.prioridade) {
            const dias = tarefa.prioridade === "alta" ? 30 : tarefa.prioridade === "media" ? 75 : 150;
            dataPrazo = new Date(now + dias * dayMs).toISOString().split("T")[0];
          }

          const { data: tarefaData, error: tarefaErr } = await admin
            .from("projeto_tarefas")
            .insert({
              projeto_id: projetoId,
              secao_id: secaoId,
              titulo: tarefa.nome,
              descricao: tarefa.descricao || null,
              ordem: ti,
              status: tarefa.isBacklog ? "pendente" : "concluida",
              prioridade: tarefa.prioridade || null,
              data_prazo: dataPrazo,
              responsavel_id: userId,
            })
            .select("id")
            .single();

          if (tarefaErr) {
            console.error(`Error creating task ${tarefa.nome}:`, tarefaErr);
            continue;
          }

          totalTarefas++;

          // Subtasks
          if (tarefa.subtarefas?.length) {
            for (let sti = 0; sti < tarefa.subtarefas.length; sti++) {
              const sub = tarefa.subtarefas[sti];
              const { error: subErr } = await admin
                .from("projeto_tarefas")
                .insert({
                  projeto_id: projetoId,
                  secao_id: secaoId,
                  titulo: sub.nome,
                  descricao: sub.descricao || null,
                  ordem: sti,
                  status: "concluida",
                  responsavel_id: userId,
                  parent_tarefa_id: tarefaData.id,
                });

              if (subErr) {
                console.error(`Error creating subtask ${sub.nome}:`, subErr);
                continue;
              }
              totalTarefas++;
            }
          }
        }
      }

      results.push({
        nome: proj.nome,
        id: projetoId,
        secoes: proj.secoes.length,
        tarefas: totalTarefas,
      });
    }

    return jsonResponse({
      status: "success",
      message: `${results.length} projetos criados com sucesso`,
      projetos: results,
      total_tarefas: results.reduce((sum, r) => sum + r.tarefas, 0),
    }, 200, req, { startMs });

  } catch (err) {
    console.error("seed-system-projects error:", err);
    return errorResponse(500, "INTERNAL_ERROR", err.message || "Erro interno", req, startMs);
  }
});
