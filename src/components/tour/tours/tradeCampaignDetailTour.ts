import { DriveStep } from "driver.js";

export const TRADE_CAMPAIGN_DETAIL_TOUR_ID = "trade-campaign-detail";

export const tradeCampaignDetailTourSteps: DriveStep[] = [
  {
    element: '[data-tour="campaign-header"]',
    popover: {
      title: "📋 Detalhes da Campanha",
      description: "Você está na página de detalhes da campanha. Aqui você registra a execução em diferentes clientes/PDVs.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="campaign-status"]',
    popover: {
      title: "🏷️ Status da Campanha",
      description: "Este badge mostra o status atual: Rascunho, Pendente Aprovação, Aprovada, Em Execução, ou Encerrada.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="campaign-tabs"]',
    popover: {
      title: "🔄 Navegação por Abas",
      description: "Use estas abas para navegar entre as diferentes seções. Siga a ordem: Lançamento → Produtos → Gastos → Validação.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="tab-lancamento"]',
    popover: {
      title: "1️⃣ PRIMEIRO: Lançamento",
      description: "Comece aqui! Selecione ou crie um lançamento para um cliente específico. Isso habilita as demais abas.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="tab-products"]',
    popover: {
      title: "2️⃣ SEGUNDO: Produtos",
      description: "Após selecionar um lançamento, registre os produtos utilizados na ação (displays, materiais, etc).",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="tab-expenses"]',
    popover: {
      title: "3️⃣ TERCEIRO: Gastos",
      description: "Declare os gastos realizados no lançamento. Supervisores aprovam ou rejeitam cada gasto.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="tab-validation"]',
    popover: {
      title: "4️⃣ QUARTO: Validação",
      description: "Supervisores e Admins validam os lançamentos aqui. Esta aba só aparece para gestores.",
      side: "bottom",
      align: "center",
    },
  },
];
