import { DriveStep } from "driver.js";

export const FABRICA_MODULE_TOUR_ID = "fabrica-module-home";

export const fabricaModuleTourSteps: DriveStep[] = [
  {
    element: '[data-tour="fabrica-header"]',
    popover: {
      title: "🏭 Módulo Fábrica",
      description: "Bem-vindo ao módulo de Fábrica! Aqui você gerencia produção, matérias-primas, fórmulas BOM e qualidade.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="fabrica-quick-actions"]',
    popover: {
      title: "⚡ Ações Rápidas",
      description: "Use estes botões para criar ordens de produção, cadastrar matérias-primas ou acessar fórmulas rapidamente.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="fabrica-main-modules"]',
    popover: {
      title: "📊 Módulos Principais",
      description: "Cards com métricas em tempo real: total de matérias-primas, produtos acabados, ordens de produção ativas e fórmulas BOM. Clique em qualquer card para acessar o módulo.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="fabrica-secondary-modules"]',
    popover: {
      title: "🔧 Mais Funcionalidades",
      description: "Expanda as categorias para acessar cadastros básicos, planejamento MRP, qualidade, recebimentos e precificação.",
      side: "top",
      align: "center",
    },
  },
];
