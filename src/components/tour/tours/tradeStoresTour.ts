import { DriveStep } from "driver.js";

export const TRADE_STORES_TOUR_ID = "trade-stores";

export const tradeStoresTourSteps: DriveStep[] = [
  {
    element: '[data-tour="stores-header"]',
    popover: {
      title: "🏪 Pontos de Venda",
      description: "Gerencie todos os PDVs cadastrados. Veja informações de rede, cidade, categoria e prioridade.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="stores-actions"]',
    popover: {
      title: "➕ Adicionar PDVs",
      description: "Use 'Nova Loja' para cadastrar manualmente ou 'Importar' para carregar múltiplos PDVs via planilha.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tour="stores-filters"]',
    popover: {
      title: "🔍 Filtros",
      description: "Filtre PDVs por status, categoria ou prioridade. Use também o filtro de IA para buscas mais específicas.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="stores-list"]',
    popover: {
      title: "📋 Lista de PDVs",
      description: "Visualize todos os PDVs. Use os ícones para ver detalhes, editar, desativar ou abrir no mapa.",
      side: "top",
      align: "center",
    },
  },
];
