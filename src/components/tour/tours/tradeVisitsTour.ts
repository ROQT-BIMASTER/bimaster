import { DriveStep } from "driver.js";

export const TRADE_VISITS_TOUR_ID = "trade-visits";

export const tradeVisitsTourSteps: DriveStep[] = [
  {
    element: '[data-tour="visits-header"]',
    popover: {
      title: "📅 Gestão de Visitas",
      description: "Planeje, agende e acompanhe visitas aos PDVs. Registre check-in/check-out e atividades realizadas.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="visits-actions"]',
    popover: {
      title: "➕ Nova Visita",
      description: "Crie uma nova visita selecionando o PDV, data e tipo de atividade planejada.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tour="visits-calendar"]',
    popover: {
      title: "📆 Visualização",
      description: "Alterne entre visualização em lista ou calendário para melhor planejamento das rotas.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="visits-list"]',
    popover: {
      title: "📋 Lista de Visitas",
      description: "Acompanhe status de cada visita: agendada, em andamento, concluída ou cancelada.",
      side: "top",
      align: "center",
    },
  },
];
