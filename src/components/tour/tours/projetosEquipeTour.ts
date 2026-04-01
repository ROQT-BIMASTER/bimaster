import { DriveStep } from "driver.js";

export const PROJETOS_EQUIPE_TOUR_ID = "projetos-equipe";

export const projetosEquipeTourSteps: DriveStep[] = [
  {
    popover: {
      title: "👥 Minha Equipe",
      description: "Painel completo de gestão da equipe. Veja métricas de produtividade, ranking de performance e tarefas de cada membro.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="equipe-cards"]',
    popover: {
      title: "🏆 Cards de Membros",
      description: "Cada card mostra: avatar, nome, cargo, score de performance, quantidade de tarefas e taxa de conclusão com barra de progresso.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="equipe-filters"]',
    popover: {
      title: "🔍 Filtros da Equipe",
      description: "Filtre membros por projeto ou busque por nome. Ideal para equipes grandes.",
      side: "bottom",
      align: "start",
    },
  },
  {
    popover: {
      title: "📊 Detalhe do Membro",
      description: "Clique em um card para abrir a visão de foco: KPIs detalhados, gráfico de evolução mensal, lista completa de tarefas com filtros por status e projeto.",
      side: "bottom",
      align: "center",
    },
  },
  {
    popover: {
      title: "📸 Atualizar Avatar",
      description: "Passe o mouse sobre o avatar de um membro para ver o botão de câmera. Admins podem atualizar a foto de qualquer membro da equipe.",
      side: "bottom",
      align: "center",
    },
  },
];
