import { DriveStep } from "driver.js";

export const TRADE_MODULE_TOUR_ID = "trade-module-home";

export const tradeModuleTourSteps: DriveStep[] = [
  {
    element: '[data-tour="trade-header"]',
    popover: {
      title: "🏪 Trade Marketing",
      description: "Bem-vindo ao módulo de Trade Marketing! Aqui você gerencia PDVs, visitas, fotos e execução em campo.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="quick-actions"]',
    popover: {
      title: "⚡ Ações Rápidas",
      description: "Use estes botões para registrar lançamentos, criar visitas e capturar fotos de forma ágil. O 'Lançamento Rápido' integra várias ações em um único fluxo.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="main-modules"]',
    popover: {
      title: "📊 Módulos Principais",
      description: "Cards com métricas em tempo real: PDVs ativos, visitas do mês, fotos capturadas e sell out. Clique em qualquer card para acessar o módulo.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="secondary-modules"]',
    popover: {
      title: "🔧 Mais Funcionalidades",
      description: "Expanda as categorias para acessar cadastros, auditorias, inteligência competitiva e gamificação.",
      side: "top",
      align: "center",
    },
  },
];
