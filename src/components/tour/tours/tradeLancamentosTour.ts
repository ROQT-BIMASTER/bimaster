import { DriveStep } from "driver.js";

export const TRADE_LANCAMENTOS_TOUR_ID = "trade-lancamentos";

export const tradeLancamentosTourSteps: DriveStep[] = [
  {
    element: '[data-tour="lancamentos-summary"]',
    popover: {
      title: "📊 Resumo dos Lançamentos",
      description: "Este card mostra o resumo: total de lançamentos, pendentes de aprovação e aprovados. Acompanhe o progresso aqui.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="new-lancamento-button"]',
    popover: {
      title: "➕ Novo Lançamento",
      description: "Clique aqui para registrar a execução da campanha em um novo cliente/PDV. Cada lançamento representa uma ação em um cliente específico.",
      side: "left",
      align: "start",
    },
  },
  {
    element: '[data-tour="import-export-buttons"]',
    popover: {
      title: "📤📥 Importar e Exportar",
      description: "Use 'Exportar Modelo' para baixar uma planilha de exemplo. Use 'Importar Planilha' para cadastrar múltiplos lançamentos de uma vez.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="lancamentos-table"]',
    popover: {
      title: "📋 Tabela de Lançamentos",
      description: "Clique em uma linha para selecionar o cliente. Isso habilita as abas de Produtos e Gastos para registrar informações específicas.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="select-lancamento-button"]',
    popover: {
      title: "➡️ Continuar para Produtos",
      description: "Após selecionar, clique na seta ou vá para a aba Produtos para registrar os materiais utilizados.",
      side: "left",
      align: "center",
    },
  },
];
