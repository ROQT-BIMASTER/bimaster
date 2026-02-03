import { QueryClient } from "@tanstack/react-query";

/**
 * Calcula o saldo disponível de uma verba de Trade
 */
export const calcularSaldoDisponivel = (budget: {
  total_amount?: number | string | null;
  spent_amount?: number | string | null;
  reserved_amount?: number | string | null;
} | null | undefined): number => {
  if (!budget) return 0;
  return (
    parseFloat(String(budget.total_amount || 0)) -
    parseFloat(String(budget.spent_amount || 0)) -
    parseFloat(String(budget.reserved_amount || 0))
  );
};

/**
 * Formata valor como moeda BRL
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

/**
 * Invalida todas as queries relacionadas a aprovações de Trade
 */
export const invalidateTradeApprovalQueries = (queryClient: QueryClient): void => {
  queryClient.invalidateQueries({ queryKey: ["trade-pending-campaigns"] });
  queryClient.invalidateQueries({ queryKey: ["trade-campaigns"] });
  queryClient.invalidateQueries({ queryKey: ["trade-budgets"] });
  queryClient.invalidateQueries({ queryKey: ["trade-pending-entries"] });
  queryClient.invalidateQueries({ queryKey: ["trade-pending-investments"] });
};

/**
 * Labels para tipos de campanha
 */
export const getCampaignTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    sell_in: "Sell-In",
    sell_out: "Sell-Out",
    institucional: "Institucional",
    cooperada: "Cooperada",
    mdf: "MDF",
    midia: "Mídia",
    incentivo: "Incentivo",
    degustacao: "Degustação",
    bonificacao: "Bonificação",
  };
  return labels[type] || type;
};

/**
 * Labels para tipos de lançamento financeiro
 */
export const getEntryTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    budget_allocation: "Alocação de Verba",
    investment: "Investimento",
    expense: "Despesa",
    revenue: "Receita",
    adjustment: "Ajuste",
  };
  return labels[type] || type;
};
