import { DriveStep } from "driver.js";

export const PROJETO_INBOX_TOUR_ID = "projeto-inbox";

export const projetoInboxTourSteps: DriveStep[] = [
  {
    popover: {
      title: "📬 Caixa de Entrada",
      description: "Central de notificações do módulo de Projetos. Receba alertas quando alguém criar tarefas, concluir atividades, mencionar você ou movimentar itens nos seus projetos.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="inbox-kpis"]',
    popover: {
      title: "📊 Resumo de Notificações",
      description: "KPIs rápidos: Não lidas, Menções (@), Favoritas (⭐) e notificações de Hoje. Monitore o volume sem precisar ler cada uma.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="inbox-tabs"]',
    popover: {
      title: "📑 Abas de Organização",
      description: "Navegue entre: Atividade (tudo), Menções (quando alguém te mencionou), Favoritas (marcadas com ⭐) e Arquivadas. Cada aba mostra o contador.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="inbox-toolbar"]',
    popover: {
      title: "🔧 Barra de Ferramentas",
      description: "Busque por texto, filtre por projeto específico e alterne entre agrupamento por tempo ou por projeto.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tour="inbox-tipo-filters"]',
    popover: {
      title: "🏷️ Filtros por Tipo",
      description: "Filtre notificações por tipo: Tarefas criadas, Concluídas, Comentários ou Movidas. Combine vários filtros simultaneamente.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="inbox-feed"]',
    popover: {
      title: "📰 Feed de Notificações",
      description: "Lista de notificações com ações rápidas: marcar como lida, favoritar (⭐) ou arquivar. Use o checkbox para selecionar várias e fazer ações em lote.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="inbox-mark-all"]',
    popover: {
      title: "✅ Marcar Todas como Lidas",
      description: "Botão para limpar todas as notificações não lidas de uma vez. Ideal para quando você já está por dentro de tudo.",
      side: "bottom",
      align: "end",
    },
  },
];
