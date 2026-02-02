import { DriveStep } from "driver.js";

export const TRADE_ADMIN_TOUR_ID = "trade-admin";

export const tradeAdminTourSteps: DriveStep[] = [
  {
    element: '[data-tour="admin-header"]',
    popover: {
      title: "⚙️ Administrativo Trade",
      description: "Central administrativa do Trade Marketing. Gerencie campanhas, verbas, usuários e configurações.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="admin-kpis"]',
    popover: {
      title: "📊 Métricas Gerais",
      description: "Visão geral: campanhas ativas, ROI médio, usuários e verbas disponíveis.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="admin-quick-actions"]',
    popover: {
      title: "⚡ Ações Rápidas",
      description: "Acesse rapidamente aprovações pendentes, verbas e contas correntes.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="admin-settings"]',
    popover: {
      title: "🔧 Configurações",
      description: "Configure níveis de aprovação e gerencie permissões de usuários.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="admin-reports"]',
    popover: {
      title: "📈 Relatórios",
      description: "Acesse relatórios detalhados de campanhas, clientes e vendedores.",
      side: "top",
      align: "center",
    },
  },
];
