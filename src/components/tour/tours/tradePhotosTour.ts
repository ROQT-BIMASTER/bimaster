import { DriveStep } from "driver.js";

export const TRADE_PHOTOS_TOUR_ID = "trade-photos";

export const tradePhotosTourSteps: DriveStep[] = [
  {
    element: '[data-tour="photos-header"]',
    popover: {
      title: "📸 Galeria de Fotos",
      description: "Visualize todas as fotos capturadas em campo. Fotos são vinculadas a PDVs e visitas.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="photos-actions"]',
    popover: {
      title: "📷 Capturar Foto",
      description: "Tire uma nova foto diretamente pelo sistema, com geolocalização e vinculação automática.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tour="photos-filters"]',
    popover: {
      title: "🔍 Filtros",
      description: "Filtre fotos por PDV, período, tipo ou status de aprovação.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="photos-gallery"]',
    popover: {
      title: "🖼️ Galeria",
      description: "Clique em qualquer foto para ampliar e ver detalhes como localização, data e PDV.",
      side: "top",
      align: "center",
    },
  },
];
