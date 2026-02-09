import { DriveStep } from "driver.js";

export const FABRICA_PRODUTOS_ACABADOS_TOUR_ID = "fabrica-produtos-acabados";

export const fabricaProdutosAcabadosTourSteps: DriveStep[] = [
  {
    element: '[data-tour="pa-header"]',
    popover: {
      title: "📦 Produtos Acabados",
      description: "Gerencie seu catálogo de produtos fabricados. Aqui você cadastra, edita e acompanha o status de cada produto.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="pa-revisao-btn"]',
    popover: {
      title: "📋 Revisão de Fichas",
      description: "Acesse todas as fichas de custos pendentes de revisão pela Diretoria. Acompanhe aprovações, apontamentos e requisitos obrigatórios.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="pa-kpis"]',
    popover: {
      title: "📊 Indicadores Rápidos",
      description: "Visualize métricas como total de produtos, acabados, intermediários, nacionais e importados em tempo real.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="pa-filtros"]',
    popover: {
      title: "🔍 Filtros e Agrupamento",
      description: "Busque por código/nome, filtre por marca ou linha, e ative o agrupamento hierárquico para organizar a visualização.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="pa-tabela"]',
    popover: {
      title: "📄 Tabela de Produtos",
      description: "Veja todos os dados: código, nome, tipo, origem, status da ficha de custos e custo total. Use os ícones de ação para acessar a ficha de custos ($), editar ou excluir.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="pa-status-ficha"]',
    popover: {
      title: "🏷️ Status da Ficha de Custos",
      description: "O badge mostra o status atual: Rascunho, Em Revisão, Aprovada ou Revisão Solicitada. Fichas com revisão solicitada ficam destacadas em vermelho.",
      side: "left",
      align: "center",
    },
  },
  {
    popover: {
      title: "💬 Chat e Requisitos",
      description: "Dentro da ficha de custos, você conta com: chat em tempo real com a Diretoria, apontamentos por insumo, requisitos obrigatórios (orçamentos, evidências) e referência direta ao insumo na mensagem.",
    },
  },
  {
    popover: {
      title: "✅ Fluxo de Aprovação",
      description: "1️⃣ Monte a ficha de custos → 2️⃣ Submeta para aprovação → 3️⃣ Diretoria analisa e pode aprovar ou solicitar revisão com requisitos → 4️⃣ Cumpra os requisitos e resubmeta. Todo o histórico de mensagens é preservado entre versões!",
    },
  },
];
