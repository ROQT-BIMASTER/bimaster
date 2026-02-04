import { DriveStep } from "driver.js";

export const TRADE_QUICK_ENTRY_TOUR_ID = "trade-quick-entry";

export const tradeQuickEntryTourSteps: DriveStep[] = [
  // Introdução
  {
    element: '[data-tour="quick-entry-dialog"]',
    popover: {
      title: "⚡ Lançamento Rápido Inteligente",
      description: "Este assistente permite registrar visitas, fotos, análises e gastos de campanha em um único fluxo. Siga os 4 passos para concluir.",
      side: "bottom",
      align: "center",
    },
  },
  // Progress bar
  {
    element: '[data-tour="quick-entry-progress"]',
    popover: {
      title: "📊 Progresso do Lançamento",
      description: "Acompanhe seu progresso pelos 4 passos. Você pode voltar a qualquer momento para ajustar informações.",
      side: "bottom",
      align: "center",
    },
  },
  // Step 1 - PDV
  {
    element: '[data-tour="quick-entry-tabs"]',
    popover: {
      title: "📑 Navegação por Passos",
      description: "PDV → Fotos + IA → Dados → Revisão. Cada aba representa uma etapa do lançamento.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="quick-entry-step1"]',
    popover: {
      title: "🏪 Passo 1: Selecione o PDV",
      description: "Busque a loja por nome, cidade ou CNPJ. Defina tipo de visita (rotina, auditoria, promoção) e a data/hora.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="quick-entry-store-search"]',
    popover: {
      title: "🔍 Busca Inteligente",
      description: "Digite parte do nome, cidade ou CNPJ para filtrar rapidamente as lojas disponíveis.",
      side: "bottom",
      align: "start",
    },
  },
  // Step 2 - Fotos + IA
  {
    element: '[data-tour="quick-entry-step2"]',
    popover: {
      title: "📸 Passo 2: Fotos e Análise IA",
      description: "Capture fotos do PDV. A IA analisará automaticamente a disposição dos produtos, share de gôndola e problemas detectados.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="quick-entry-photos-before"]',
    popover: {
      title: "📷 Fotos ANTES",
      description: "Tire fotos da situação atual da gôndola. Essas imagens serão analisadas pela IA para gerar insights.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="quick-entry-photos-after"]',
    popover: {
      title: "📷 Fotos DEPOIS (Opcional)",
      description: "Após realizar ajustes no PDV, capture fotos para comparação. Útil para auditorias e relatórios de execução.",
      side: "bottom",
      align: "center",
    },
  },
  // Step 3 - Dados
  {
    element: '[data-tour="quick-entry-step3"]',
    popover: {
      title: "📊 Passo 3: Dados da Visita",
      description: "Registre share de gôndola, medições de prateleira, promoções ativas e gastos de campanha.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="quick-entry-shelf-share"]',
    popover: {
      title: "📈 Share de Gôndola",
      description: "Informe a quantidade de faces (frentes) dos nossos produtos e dos concorrentes para calcular o share.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="quick-entry-shelf-measures"]',
    popover: {
      title: "📏 Medições de Prateleira",
      description: "Registre largura, altura e profundidade do espaço ocupado para análises de merchandising.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="quick-entry-campaign"]',
    popover: {
      title: "💰 Campanha e Gasto",
      description: "Vincule a visita a uma campanha e registre gastos realizados. O valor será enviado para aprovação antes de debitar da verba.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="quick-entry-evidence"]',
    popover: {
      title: "📎 Evidências",
      description: "Anexe fotos de comprovantes, notas fiscais ou materiais utilizados como evidência do gasto.",
      side: "top",
      align: "center",
    },
  },
  // Step 4 - Revisão
  {
    element: '[data-tour="quick-entry-step4"]',
    popover: {
      title: "✅ Passo 4: Revisão Final",
      description: "Revise todas as informações antes de salvar. Adicione observações finais sobre a visita.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="quick-entry-summary"]',
    popover: {
      title: "📋 Resumo do Lançamento",
      description: "Confira o resumo com PDV, fotos, faces, promoções e valores. Tudo será salvo ao clicar em 'Concluir'.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="quick-entry-submit"]',
    popover: {
      title: "🚀 Concluir Lançamento",
      description: "Ao finalizar, a visita será registrada, fotos enviadas para análise IA e gastos para aprovação. Você receberá opções de próximos passos!",
      side: "top",
      align: "center",
    },
  },
];
