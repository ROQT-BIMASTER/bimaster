import { DriveStep } from "driver.js";

export const TRADE_EXPENSES_TOUR_ID = "trade-expenses";

export const tradeExpensesTourSteps: DriveStep[] = [
  {
    element: '[data-tour="expenses-verba-cards"]',
    popover: {
      title: "💰 Controle de Verba",
      description: "Estes cards mostram: verba orçada, valor previsto, valor realizado (aprovado) e saldo disponível. Monitore o orçamento aqui.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="expenses-progress"]',
    popover: {
      title: "📊 Barra de Progresso",
      description: "Visualize quanto do orçamento já foi utilizado. Se ultrapassar 100%, a barra ficará vermelha indicando estouro.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="declare-expense-button"]',
    popover: {
      title: "➕ Declarar Gasto",
      description: "Clique aqui para registrar um novo gasto. Escolha a categoria, descreva o gasto e informe os valores (previsto, orçado e realizado).",
      side: "left",
      align: "start",
    },
  },
  {
    element: '[data-tour="expenses-table"]',
    popover: {
      title: "📋 Tabela de Gastos",
      description: "Aqui você vê todos os gastos registrados. Supervisores podem aprovar (✓) ou rejeitar (✗) cada gasto na coluna de Ações.",
      side: "top",
      align: "center",
    },
  },
];
