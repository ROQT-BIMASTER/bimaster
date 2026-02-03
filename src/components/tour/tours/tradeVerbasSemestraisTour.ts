import { DriveStep } from "driver.js";

export const TRADE_VERBAS_SEMESTRAIS_TOUR_ID = "trade-verbas-semestrais";

export const tradeVerbasSemestraisTourSteps: DriveStep[] = [
  {
    element: '[data-tour="verbas-header"]',
    popover: {
      title: "💰 Verbas Semestrais",
      description: "Gerencie o planejamento e acompanhamento de verbas do Trade Marketing por semestre. Controle o orçamento disponível para suas ações.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="verbas-kpis"]',
    popover: {
      title: "📊 Indicadores de Verba",
      description: "Acompanhe: verbas ativas, total planejado, valor utilizado e saldo disponível. A barra de progresso mostra o percentual de utilização.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="verbas-filtro"]',
    popover: {
      title: "🔍 Filtro por Semestre",
      description: "Filtre as verbas por período específico. Você também pode visualizar verbas inativas para histórico e auditoria.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="verbas-nova"]',
    popover: {
      title: "➕ Criar Nova Verba",
      description: "Clique aqui para solicitar uma nova verba. Preencha os dados, anexe documentos de aprovação e envie. A solicitação será encaminhada automaticamente ao Financeiro para análise e aprovação.",
      side: "left",
      align: "center",
    },
  },
  {
    element: '[data-tour="verbas-tabela"]',
    popover: {
      title: "📋 Verbas do Período",
      description: "Visualize todas as verbas cadastradas com código, período, valores e status. Use o menu de ações para editar, inativar ou excluir verbas.",
      side: "top",
      align: "center",
    },
  },
  {
    popover: {
      title: "✅ Fluxo de Aprovação",
      description: "Após criar uma verba, ela será automaticamente encaminhada para aprovação do departamento Financeiro. Você receberá uma notificação quando a verba for aprovada ou se houver solicitação de ajustes. Anexe documentos para agilizar a aprovação!",
      side: "top",
      align: "center",
    },
  },
];
