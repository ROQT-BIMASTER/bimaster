import { DriveStep } from "driver.js";

export const TRADE_PRODUCTS_TOUR_ID = "trade-products";

export const tradeProductsTourSteps: DriveStep[] = [
  {
    element: '[data-tour="products-kpis"]',
    popover: {
      title: "📊 Resumo de Produtos",
      description: "Estes cards mostram: total de produtos cadastrados, quantidade total e valor total investido neste lançamento.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="add-product-button"]',
    popover: {
      title: "➕ Adicionar Produto",
      description: "Clique aqui para registrar um produto utilizado na ação (ex: display, banner, material promocional). Informe quantidade e custo unitário.",
      side: "left",
      align: "start",
    },
  },
  {
    element: '[data-tour="products-table"]',
    popover: {
      title: "📋 Lista de Produtos",
      description: "Aqui você vê todos os produtos registrados neste lançamento, com quantidades, custos unitários e totais.",
      side: "top",
      align: "center",
    },
  },
];
