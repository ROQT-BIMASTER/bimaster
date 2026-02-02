import { DriveStep } from "driver.js";

export const TRADE_CAMPAIGNS_TOUR_ID = "trade-campaigns-list";

export const tradeCampaignsTourSteps: DriveStep[] = [
  {
    element: '[data-tour="campaigns-header"]',
    popover: {
      title: "📋 Campanhas de Trade Marketing",
      description: "Bem-vindo ao módulo de Campanhas! Aqui você gerencia todas as ações promocionais da empresa, desde a criação até a análise de resultados.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="campaigns-kpis"]',
    popover: {
      title: "📊 Métricas Gerais",
      description: "Estes cards mostram um resumo das campanhas: total de campanhas, valor investido, receita gerada e ROI médio. Acompanhe a performance geral aqui.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="new-campaign-button"]',
    popover: {
      title: "➕ Criar Nova Campanha",
      description: "Clique aqui para criar uma nova campanha. Você definirá código, tipo, verba, datas e responsável. Após criar, a campanha ficará em 'Rascunho'.",
      side: "left",
      align: "start",
    },
  },
  {
    element: '[data-tour="campaigns-table"]',
    popover: {
      title: "📜 Lista de Campanhas",
      description: "Aqui você vê todas as campanhas cadastradas. Use o ícone do olho (👁) para abrir os detalhes e registrar lançamentos, produtos e gastos.",
      side: "top",
      align: "center",
    },
  },
];
