import { DriveStep } from "driver.js";

export const FABRICA_FORMULA_TOUR_ID = "fabrica-formula-editor";

export const fabricaFormulaTourSteps: DriveStep[] = [
  {
    element: '[data-tour="formula-header"]',
    popover: {
      title: "📝 Editor de Fórmulas",
      description: "Aqui você cria e edita fórmulas de produção (BOM - Bill of Materials). Uma fórmula define os ingredientes e proporções para fabricar um produto.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="formula-produto"]',
    popover: {
      title: "📦 Produto",
      description: "Primeiro, selecione o produto acabado que esta fórmula irá produzir. Cada produto pode ter apenas uma fórmula ativa.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="formula-info-tecnica"]',
    popover: {
      title: "⚙️ Informações Técnicas",
      description: "Configure o rendimento esperado (quantas unidades), tempo de produção, perdas estimadas, temperatura e pH ideais.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="formula-tabs"]',
    popover: {
      title: "📑 Abas da Fórmula",
      description: "A fórmula possui três seções: Ingredientes (matérias-primas), Roteiro de Produção (passo a passo) e Ficha de Custos (análise de custos).",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="formula-ingredientes"]',
    popover: {
      title: "🧪 Ingredientes",
      description: "Adicione as matérias-primas com quantidades e percentuais. A soma dos percentuais deve ser 100%. Você pode definir criticidade e materiais alternativos.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="formula-roteiro"]',
    popover: {
      title: "📋 Roteiro de Produção",
      description: "Defina o passo a passo para fabricar o produto: máquinas a utilizar, tempos, temperaturas, pressões e instruções detalhadas para os operadores.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="formula-custos"]',
    popover: {
      title: "💰 Ficha de Custos",
      description: "Após salvar a fórmula, você pode acessar a Ficha Técnica de Custos para detalhar custos de NF, serviço, condição, mão de obra e markup.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="formula-actions"]',
    popover: {
      title: "💾 Ações",
      description: "Use 'Simular Produção' para testar a fórmula com diferentes quantidades, e 'Salvar' para gravar as alterações.",
      side: "left",
      align: "center",
    },
  },
];
