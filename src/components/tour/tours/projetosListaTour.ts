import { DriveStep } from "driver.js";

export const PROJETOS_LISTA_TOUR_ID = "projetos-lista";

export const projetosListaTourSteps: DriveStep[] = [
  {
    popover: {
      title: "📁 Lista de Projetos",
      description: "Visão geral de todos os projetos da empresa. Aqui você cria, acompanha e gerencia cada projeto com métricas de progresso em tempo real.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="projetos-novo"]',
    popover: {
      title: "➕ Criar Novo Projeto",
      description: "Clique para criar um novo projeto. Defina nome, descrição, cor e equipe inicial.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tour="projetos-tabela"]',
    popover: {
      title: "📊 Tabela de Projetos",
      description: "Cada linha mostra: nome, status (No Prazo, Em Andamento, Atrasado, Concluído), barra de progresso, contagem de tarefas, membros da equipe e data de criação.",
      side: "top",
      align: "center",
    },
  },
  {
    popover: {
      title: "🎨 Barra Colorida",
      description: "A borda colorida à esquerda identifica visualmente cada projeto pela cor escolhida na criação.",
      side: "bottom",
      align: "center",
    },
  },
  {
    popover: {
      title: "👥 Membros e Avatares",
      description: "Veja os membros de cada projeto com seus avatares. Quando há mais de 4, aparece o indicador '+N' com a contagem restante.",
      side: "bottom",
      align: "center",
    },
  },
  {
    popover: {
      title: "⚙️ Menu de Ações",
      description: "Ao passar o mouse sobre um projeto, o ícone '⋯' aparece com opções: Finalizar Projeto (marca como 100%) ou Excluir.",
      side: "bottom",
      align: "center",
    },
  },
];
