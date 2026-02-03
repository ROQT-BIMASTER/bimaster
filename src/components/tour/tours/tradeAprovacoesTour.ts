import { DriveStep } from "driver.js";

export const TRADE_APROVACOES_TOUR_ID = "trade-aprovacoes-tour";

export const tradeAprovacoesTourSteps: DriveStep[] = [
  {
    element: '[data-tour="aprovacoes-header"]',
    popover: {
      title: "Central de Aprovações 🔐",
      description: "Esta é a tela onde supervisores e administradores revisam e aprovam todos os lançamentos financeiros enviados pela equipe de campo.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="aprovacoes-kpis"]',
    popover: {
      title: "Métricas de Aprovação 📊",
      description: "Visualize rapidamente quantos itens aguardam sua aprovação, o valor total pendente e se há ações necessárias.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="aprovacoes-tabela"]',
    popover: {
      title: "Fila de Aprovação 📋",
      description: "Aqui aparecem todos os lançamentos pendentes: campanhas, investimentos PDV e despesas enviadas pelos vendedores e promotores.",
      side: "top",
      align: "center",
    },
  },
  {
    popover: {
      title: "Fluxo de Aprovação 🔄",
      description: "Quando um vendedor envia uma campanha ou lançamento, ele automaticamente entra nesta fila para análise. O financeiro/supervisor revisa cada item antes de liberar.",
      side: "bottom",
      align: "center",
    },
  },
  {
    popover: {
      title: "Decisão de Aprovação ✅❌",
      description: "Ao clicar em 'Revisar', você pode APROVAR (libera o valor da verba) ou REJEITAR (devolve para correção). Cada decisão é registrada com histórico completo.",
      side: "bottom",
      align: "center",
    },
  },
  {
    popover: {
      title: "Pronto para Aprovar! 🎯",
      description: "Revise os detalhes de cada lançamento, verifique se está dentro da verba disponível e tome sua decisão. Toda aprovação impacta diretamente o saldo das verbas semestrais.",
      side: "bottom",
      align: "center",
    },
  },
];
