import { DriveStep } from "driver.js";

export const TRADE_FINANCEIRO_TOUR_ID = "trade-financeiro";

export const tradeFinanceiroTourSteps: DriveStep[] = [
  {
    element: '[data-tour="financeiro-header"]',
    popover: {
      title: "💰 Financeiro Trade Marketing",
      description: "Central financeira do Trade Marketing. Gerencie verbas, investimentos, aprovações e acompanhe campanhas.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="financeiro-cards"]',
    popover: {
      title: "📊 Navegação Rápida",
      description: "Acesse Dashboard, Campanhas, Verbas, Contas Correntes e outras áreas financeiras. O card 'Dashboard Financeiro' oferece visão consolidada.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="financeiro-kpis"]',
    popover: {
      title: "📈 Resumo de Verbas",
      description: "Acompanhe total de verbas disponíveis, valores investidos e saldo disponível em tempo real.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="financeiro-tabs"]',
    popover: {
      title: "📁 Gestão Detalhada",
      description: "Use as abas para gerenciar verbas, plano de contas e investimentos. Cada aba oferece funcionalidades específicas.",
      side: "top",
      align: "center",
    },
  },
];
