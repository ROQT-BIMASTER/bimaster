import { DriveStep } from "driver.js";

export const TRADE_DASHBOARD_TOUR_ID = "trade-dashboard";

export const tradeDashboardTourSteps: DriveStep[] = [
  {
    element: '[data-tour="dashboard-header"]',
    popover: {
      title: "📊 Dashboard Financeiro",
      description: "Visão consolidada das finanças do Trade Marketing. Acompanhe verbas, campanhas e pagamentos em um só lugar.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="dashboard-kpis"]',
    popover: {
      title: "📈 KPIs Principais",
      description: "Métricas em tempo real: verbas disponíveis, campanhas ativas, pagamentos pendentes e totais investidos.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="dashboard-charts"]',
    popover: {
      title: "📉 Gráficos e Análises",
      description: "Visualize a distribuição de verbas, status de campanhas e evolução dos investimentos ao longo do tempo.",
      side: "top",
      align: "center",
    },
  },
];
