import { DriveStep } from "driver.js";

export const MINHAS_TAREFAS_TOUR_ID = "minhas-tarefas";

export const minhasTarefasTourSteps: DriveStep[] = [
  {
    popover: {
      title: "✅ Minhas Tarefas",
      description: "Central de gestão de todas as tarefas atribuídas a você. Aqui você controla prazos, prioridades e progresso de cada atividade.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="mt-kpis"]',
    popover: {
      title: "📊 Indicadores",
      description: "KPIs de produtividade: total de tarefas, concluídas, atrasadas e pendentes. Acompanhe em tempo real seu desempenho.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="mt-nova-tarefa"]',
    popover: {
      title: "➕ Criar Nova Tarefa",
      description: "Clique para abrir o formulário de criação. Defina título, projeto, prioridade e prazo da tarefa.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tour="mt-views"]',
    popover: {
      title: "👁️ Visões de Trabalho",
      description: "Alterne entre 3 visões: Lista (agrupada por prazo), Quadro (Kanban por status) e Calendário (visualização mensal). Escolha a que melhor se adapta ao seu fluxo.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tour="mt-filters"]',
    popover: {
      title: "🔍 Filtros e Busca",
      description: "Busque por nome, filtre por prioridade (Urgente, Alta, Média, Baixa) ou por projeto específico. Combine filtros para encontrar exatamente o que precisa.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="mt-content"]',
    popover: {
      title: "📋 Lista de Tarefas",
      description: "Suas tarefas organizadas por período: Atrasadas (vermelho), Hoje, Esta Semana, Próxima Semana e Sem Data. Clique no checkbox redondo para concluir. Clique na tarefa para abrir o painel de detalhes.",
      side: "top",
      align: "center",
    },
  },
  {
    popover: {
      title: "🎯 Seleção Múltipla",
      description: "Use o checkbox quadrado (aparece ao passar o mouse) para selecionar várias tarefas. Uma barra de ações aparecerá para concluir em lote.",
      side: "bottom",
      align: "center",
    },
  },
  {
    popover: {
      title: "📝 Painel de Detalhes",
      description: "Ao clicar em uma tarefa, um painel lateral abre com todas as informações: título, descrição, status, prioridade, prazo e projeto vinculado.",
      side: "bottom",
      align: "center",
    },
  },
];
