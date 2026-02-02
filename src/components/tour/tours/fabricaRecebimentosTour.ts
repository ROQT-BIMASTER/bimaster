import { DriveStep } from "driver.js";

export const FABRICA_RECEBIMENTOS_TOUR_ID = "fabrica-recebimentos";

export const fabricaRecebimentosTourSteps: DriveStep[] = [
  {
    element: '[data-tour="receb-header"]',
    popover: {
      title: "📥 Recebimentos XML",
      description: "Importe notas fiscais de compra (NF-e) diretamente do XML. O sistema extrai automaticamente fornecedor, produtos e valores.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="receb-upload"]',
    popover: {
      title: "📤 Upload de XML",
      description: "Arraste ou clique para fazer upload do arquivo XML da nota fiscal. Múltiplos arquivos são suportados.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="receb-list"]',
    popover: {
      title: "📋 Notas Recebidas",
      description: "Visualize todas as notas importadas com número, fornecedor, data, valor e status de processamento.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="receb-vinculacao"]',
    popover: {
      title: "🔗 Vinculação",
      description: "Vincule os produtos da nota às matérias-primas cadastradas. O sistema sugere vinculações automáticas baseadas em código ou descrição.",
      side: "left",
      align: "center",
    },
  },
  {
    element: '[data-tour="receb-conferencia"]',
    popover: {
      title: "✅ Conferência",
      description: "Após vincular, faça a conferência física do material. O sistema atualiza automaticamente o estoque e o custo unitário (FIFO ou média ponderada).",
      side: "top",
      align: "center",
    },
  },
];
