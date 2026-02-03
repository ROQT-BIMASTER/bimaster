import { DriveStep } from "driver.js";

export const TRADE_CAMPAIGN_APPROVAL_TOUR_ID = "trade-campaign-approval-tour";

export const tradeCampaignApprovalTourSteps: DriveStep[] = [
  {
    element: '[data-tour="approval-header"]',
    popover: {
      title: "Revisão de Campanha 🎯",
      description: "Aqui você analisa os detalhes da campanha antes de tomar sua decisão de aprovação ou rejeição.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="approval-info"]',
    popover: {
      title: "Informações da Campanha 📋",
      description: "Verifique: código, tipo, nome, descrição, período de execução e custo estimado da campanha.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="approval-requester"]',
    popover: {
      title: "Dados do Solicitante 👤",
      description: "Identifique quem criou a campanha. Útil para contato em caso de dúvidas.",
      side: "right",
      align: "center",
    },
  },
  {
    element: '[data-tour="approval-budget"]',
    popover: {
      title: "Vinculação de Verba 💰",
      description: "OBRIGATÓRIO! Selecione uma verba aprovada com saldo suficiente para cobrir o custo estimado da campanha.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="approval-request-budget"]',
    popover: {
      title: "Sem Verba Disponível? 📊",
      description: "Se não houver verba com saldo suficiente, você pode solicitar uma nova verba ou complemento diretamente ao Financeiro.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="approval-pending-budgets"]',
    popover: {
      title: "Verbas em Aprovação ⏳",
      description: "Aqui você vê as solicitações de verba aguardando aprovação do Financeiro. Clique no link para acessar o Planejamento de Verbas.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="approval-notes"]',
    popover: {
      title: "Observações 📝",
      description: "Adicione notas opcionais para registro interno. Essas observações ficam no histórico da campanha.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="approval-reject-reason"]',
    popover: {
      title: "Motivo de Rejeição ❌",
      description: "Se for rejeitar a campanha, informe o motivo aqui. O solicitante receberá essa informação para fazer correções.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="approval-actions"]',
    popover: {
      title: "Decisão Final ✅",
      description: "Escolha: REJEITAR (devolve para correção) ou APROVAR (libera a campanha e reserva o valor na verba selecionada).",
      side: "top",
      align: "center",
    },
  },
  {
    popover: {
      title: "Gestão de Verbas 📊",
      description: "Após aprovar, o valor será reservado na verba. Para gerenciar todas as verbas semestrais, acesse: Trade → Financeiro → Verbas Semestrais.",
      side: "bottom",
      align: "center",
    },
  },
];
