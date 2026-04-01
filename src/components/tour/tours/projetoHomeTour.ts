import { DriveStep } from "driver.js";

export const PROJETO_HOME_TOUR_ID = "projeto-home";

export const projetoHomeTourSteps: DriveStep[] = [
  {
    popover: {
      title: "🏠 Bem-vindo à sua Home",
      description: "Esta é sua página inicial personalizada. Aqui você tem uma visão geral de tudo que precisa fazer hoje: tarefas, projetos e atividades recentes.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="home-kpis"]',
    popover: {
      title: "📊 KPIs de Produtividade",
      description: "Métricas em tempo real: total de tarefas, concluídas hoje, atrasadas e pendentes. Acompanhe sua produtividade diária de forma visual.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="home-quick-actions"]',
    popover: {
      title: "⚡ Ações Rápidas",
      description: "Atalhos para as ações mais comuns: criar tarefa, ir para Minhas Tarefas, acessar a Caixa de Entrada ou ver seus projetos.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="home-tarefas"]',
    popover: {
      title: "📋 Suas Tarefas por Prazo",
      description: "Lista de tarefas agrupadas temporalmente: Atrasadas, Hoje, Esta Semana, Mais Tarde e Concluídas. Clique no checkbox para concluir direto daqui.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="home-projetos"]',
    popover: {
      title: "📁 Meus Projetos",
      description: "Seus projetos ativos com barra de progresso e contagem de tarefas pendentes/atrasadas. Clique para ir direto ao projeto.",
      side: "left",
      align: "start",
    },
  },
  {
    element: '[data-tour="home-atividades"]',
    popover: {
      title: "📰 Atividades Recentes",
      description: "Feed das últimas ações nos seus projetos: tarefas criadas, concluídas, comentários e movimentações da equipe.",
      side: "left",
      align: "start",
    },
  },
];
