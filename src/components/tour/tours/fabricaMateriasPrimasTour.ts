import { DriveStep } from "driver.js";

export const FABRICA_MATERIAS_PRIMAS_TOUR_ID = "fabrica-materias-primas";

export const fabricaMateriasPrimasTourSteps: DriveStep[] = [
  {
    element: '[data-tour="mps-header"]',
    popover: {
      title: "📦 Matérias-Primas",
      description: "Gerencie todas as matérias-primas utilizadas na produção. Aqui você cadastra, edita e controla o estoque de insumos.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="mps-filters"]',
    popover: {
      title: "🔍 Filtros",
      description: "Use os filtros para buscar por nome, código ou fornecedor. Você também pode filtrar por categoria e status do material.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="mps-add-button"]',
    popover: {
      title: "➕ Nova Matéria-Prima",
      description: "Clique aqui para cadastrar uma nova matéria-prima. Você definirá código, nome, unidade de medida, fornecedor e custo unitário.",
      side: "left",
      align: "center",
    },
  },
  {
    element: '[data-tour="mps-table"]',
    popover: {
      title: "📋 Lista de Materiais",
      description: "Visualize todas as matérias-primas cadastradas com código, nome, unidade, fornecedor, custo e status. Clique em uma linha para editar.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="mps-import"]',
    popover: {
      title: "📤 Importação",
      description: "Importe matérias-primas em lote via arquivo Excel ou através do recebimento de XML de notas fiscais.",
      side: "left",
      align: "center",
    },
  },
];
