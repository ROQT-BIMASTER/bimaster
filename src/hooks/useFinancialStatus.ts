import { useMemo } from "react";
import { parseLocalDate, getToday } from "@/utils/dateUtils";

// Helper para calcular status financeiro baseado na data de vencimento
export function calculateFinancialStatus(
  dataVencimento: string | null | undefined,
  dataPagamento: string | null | undefined,
  statusAtual?: string
): 'vencido' | 'pendente' | 'pago' | 'parcial' {
  const statusLower = (statusAtual || '').toLowerCase().trim();

  // 1) Se o banco informou um status reconhecido, ele é a fonte da verdade.
  //    (Evita casos onde data_pagamento vem preenchida mesmo para títulos pendentes.)
  if (statusLower === 'pago') return 'pago';
  if (statusLower === 'parcial') return 'parcial';
  if (statusLower === 'vencido') return 'vencido';
  if (statusLower === 'pendente') return 'pendente';

  // 2) Fallback: se não há status válido, inferir pelo pagamento/data.
  if (dataPagamento) {
    return 'pago';
  }

  // Se não tem data de vencimento, assume pendente
  if (!dataVencimento) {
    return 'pendente';
  }

  const hoje = getToday();
  const vencimento = parseLocalDate(dataVencimento);

  if (!vencimento) {
    return 'pendente';
  }

  vencimento.setHours(0, 0, 0, 0);

  // Se vencimento < hoje e não pago → VENCIDO
  if (vencimento < hoje) {
    return 'vencido';
  }

  // Se vencimento >= hoje e não pago → PENDENTE
  return 'pendente';
}

// Hook para processar lista de contas com status calculado
export function useCalculatedFinancialStatus<T extends { 
  data_vencimento?: string | null; 
  data_pagamento?: string | null;
  data_recebimento?: string | null;
  status?: string | null;
}>(contas: T[] | undefined): (T & { statusCalculado: string })[] {
  return useMemo(() => {
    if (!contas) return [];
    
    return contas.map(conta => ({
      ...conta,
      statusCalculado: calculateFinancialStatus(
        conta.data_vencimento,
        conta.data_pagamento || conta.data_recebimento,
        conta.status || undefined
      )
    }));
  }, [contas]);
}

// Constantes de status para uso consistente
export const FINANCIAL_STATUS = {
  VENCIDO: 'vencido',
  PENDENTE: 'pendente',
  PAGO: 'pago',
  PARCIAL: 'parcial'
} as const;

export type FinancialStatusType = typeof FINANCIAL_STATUS[keyof typeof FINANCIAL_STATUS];
