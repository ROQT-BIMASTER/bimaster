import { DriveStep } from "driver.js";

export const CONTAS_PAGAR_TOUR_ID = "contas-a-pagar";

export const contasPagarTourSteps: DriveStep[] = [
  {
    element: '[data-tour="contas-pagar-header"]',
    popover: {
      title: "💰 Contas a Pagar",
      description: "Gerencie todas as suas contas a pagar, fornecedores e orçamentos. Visualize vencimentos, acompanhe pagamentos e controle seu fluxo de caixa.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="contas-pagar-kpis"]',
    popover: {
      title: "📊 Indicadores Financeiros",
      description: "Acompanhe os principais KPIs: valores pagos no mês, vencendo hoje, total a pagar e valores vencidos que precisam de atenção.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="contas-pagar-filtros"]',
    popover: {
      title: "🔍 Filtros Avançados",
      description: "Filtre por ano, mês, empresa, departamento, portador e datas específicas para encontrar exatamente o que precisa.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="contas-pagar-tabs"]',
    popover: {
      title: "📑 Visualizações",
      description: "Navegue entre Dashboard com gráficos, Calendário de vencimentos, lista de Contas, Orçamentos, Classificação IA e Ajuste para o DRE.",
      side: "top",
      align: "start",
    },
  },
  {
    element: '[data-tour="contas-pagar-dashboard"]',
    popover: {
      title: "📈 Dashboard Analítico",
      description: "Visualize a evolução mensal, distribuição por departamento, status dos títulos e principais fornecedores em gráficos interativos.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="contas-pagar-acoes"]',
    popover: {
      title: "⚡ Ações Rápidas",
      description: "Exporte dados para Excel, solicite novos orçamentos, acesse a sincronização com ERP e a Auditoria com Inteligência Artificial.",
      side: "left",
      align: "center",
    },
  },
];
