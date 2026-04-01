import { DriveStep } from "driver.js";

export const PROJETO_DETALHE_TOUR_ID = "projeto-detalhe";

export const projetoDetalheTourSteps: DriveStep[] = [
  {
    popover: {
      title: "📋 Detalhe do Projeto",
      description: "Ambiente completo de gestão do projeto. Aqui você gerencia tarefas, equipe, cronograma, arquivos e briefings em um só lugar.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="pd-header"]',
    popover: {
      title: "🏷️ Header do Projeto",
      description: "Nome do projeto, status e ações rápidas. Use o seletor de cor de fundo para personalizar visualmente o ambiente do projeto.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="pd-tabs"]',
    popover: {
      title: "📑 Abas de Trabalho",
      description: "Navegue entre as visões: Lista (tarefas em seções), Quadro (Kanban), Cronograma (timeline), Calendário, Painel, Briefings, Equipe e Arquivos.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="pd-filters"]',
    popover: {
      title: "🔍 Filtros e Ordenação",
      description: "Filtre tarefas por responsável, prioridade, status ou seção. Ordene por prazo, prioridade ou data de criação.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="pd-add-task"]',
    popover: {
      title: "➕ Criar Tarefa",
      description: "Adicione tarefas diretamente na seção desejada. Digite o título e pressione Enter — a tarefa é criada instantaneamente.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tour="pd-content"]',
    popover: {
      title: "📄 Área de Conteúdo",
      description: "Conteúdo principal que muda conforme a aba selecionada. Na Lista, as tarefas são organizadas em seções colapsáveis com drag-and-drop.",
      side: "top",
      align: "center",
    },
  },
  {
    popover: {
      title: "📊 Quadro Kanban",
      description: "Na aba Quadro, suas tarefas aparecem em colunas por status: Pendente, Em Andamento, Concluída. Arraste cards entre colunas para atualizar o status.",
      side: "bottom",
      align: "center",
    },
  },
  {
    popover: {
      title: "📅 Cronograma & Calendário",
      description: "O Cronograma mostra tarefas em timeline (estilo Gantt) e o Calendário distribui as tarefas no mês. Ideal para planejamento de prazos.",
      side: "bottom",
      align: "center",
    },
  },
  {
    popover: {
      title: "👥 Equipe & Arquivos",
      description: "Na aba Equipe, veja membros e métricas individuais. Em Arquivos, gerencie documentos anexados ao projeto. Briefings permite criar resumos e escopos.",
      side: "bottom",
      align: "center",
    },
  },
  {
    popover: {
      title: "🗑️ Lixeira de Tarefas",
      description: "Tarefas excluídas vão para a lixeira e podem ser restauradas. Acesse pelo ícone de lixeira no header do projeto.",
      side: "bottom",
      align: "center",
    },
  },
];
