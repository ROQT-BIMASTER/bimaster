import { DriveStep } from "driver.js";

export const FABRICA_TABELAS_PRECO_TOUR_ID = "fabrica-tabelas-preco";

export const fabricaTabelasPrecoTourSteps: DriveStep[] = [
  {
    element: '[data-tour="precos-header"]',
    popover: {
      title: "💰 Tabelas de Preço",
      description: "Gerencie toda a cadeia de precificação: desde o custo de fábrica até o preço final de venda, passando por distribuidores e representantes.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="precos-cadeia"]',
    popover: {
      title: "🔗 Cadeia de Precificação",
      description: "Visualize a hierarquia de preços: Fábrica → Margem → Distribuidor → Representante → Varejo. Cada nível adiciona sua margem.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="precos-matriz"]',
    popover: {
      title: "📊 Matriz Comparativa",
      description: "Compare preços entre diferentes tabelas e produtos. Visualize margens, variações e identifique oportunidades de ajuste.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="precos-limites"]',
    popover: {
      title: "🛡️ Limites de Preço",
      description: "Configure preços máximos e mínimos por produto ou tabela. Proteja suas margens e controle descontos autorizados.",
      side: "left",
      align: "center",
    },
  },
  {
    element: '[data-tour="precos-historico"]',
    popover: {
      title: "📈 Histórico",
      description: "Acompanhe a evolução de preços ao longo do tempo. Visualize tendências e compare com períodos anteriores.",
      side: "top",
      align: "center",
    },
  },
];
