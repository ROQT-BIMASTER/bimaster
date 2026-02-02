import { DriveStep } from "driver.js";

export const FABRICA_ORDENS_TOUR_ID = "fabrica-ordens-producao";

export const fabricaOrdensTourSteps: DriveStep[] = [
  {
    element: '[data-tour="ordens-header"]',
    popover: {
      title: "📋 Ordens de Produção",
      description: "Gerencie as ordens de produção (OPs) da fábrica. Aqui você cria, acompanha e controla toda a produção.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="ordens-nova"]',
    popover: {
      title: "➕ Nova OP",
      description: "Crie uma nova ordem de produção selecionando o produto, quantidade desejada e data programada. O sistema calcula automaticamente os materiais necessários.",
      side: "left",
      align: "center",
    },
  },
  {
    element: '[data-tour="ordens-kanban"]',
    popover: {
      title: "📊 Visão Kanban",
      description: "Visualize as OPs em formato Kanban: Programadas, Em Produção, Pausadas e Finalizadas. Arraste para mudar o status.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="ordens-lista"]',
    popover: {
      title: "📝 Lista de OPs",
      description: "Visualize todas as ordens com número, produto, quantidade, data, responsável e status. Use filtros para localizar rapidamente.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="ordens-apontamento"]',
    popover: {
      title: "⏱️ Apontamentos",
      description: "Registre apontamentos de produção: início, pausas, conclusão e ocorrências. Os operadores podem usar o terminal de apontamento.",
      side: "left",
      align: "center",
    },
  },
];
