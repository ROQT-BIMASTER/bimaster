import { useMemo } from "react";
import { parseLocalDate, getToday } from "@/utils/dateUtils";

/**
 * Calcula o status financeiro de um título (AP/AR) usando uma hierarquia
 * contábil estrita — valores monetários são a fonte da verdade, datas
 * apenas desempatam entre "pendente" e "vencido".
 *
 *   1) valor_aberto ≤ R$ 0,005          → "pago"     (quitado)
 *   2) valor_pago > 0 e aberto > 0      → "parcial"  (pagamento parcial)
 *   3) data_vencimento < hoje           → "vencido"  (saldo aberto, venceu)
 *   4) caso contrário                   → "pendente"
 *
 * Por que NÃO confiamos em `status` textual nem em `data_pagamento`:
 *   - O ERP preenche `data_pagamento` com a data prevista mesmo antes
 *     da quitação efetiva, levando a falsos "pagos".
 *   - O campo `status` é calculado na origem por uma regra que não
 *     reflete o saldo após cada sync incremental.
 *
 * `valorAberto`/`valorPago` são opcionais para manter compatibilidade
 * com chamadas antigas (que caem no fallback puramente por data).
 */
export function calculateFinancialStatus(
  dataVencimento: string | null | undefined,
  dataPagamento: string | null | undefined,
  statusAtual?: string,
  valorAberto?: number | null,
  valorPago?: number | null,
): 'vencido' | 'pendente' | 'pago' | 'parcial' {
  const statusLower = (statusAtual || '').toLowerCase().trim();

  // 1) Fonte da verdade contábil: valores monetários.
  const aberto = typeof valorAberto === 'number' ? valorAberto : NaN;
  const pago = typeof valorPago === 'number' ? valorPago : 0;

  if (!Number.isNaN(aberto)) {
    // Quitado (tolerância de 1 centavo p/ erros de arredondamento)
    if (aberto <= 0.005) {
      return 'pago';
    }
    // Pagamento parcial: já recebeu algo mas ainda há saldo
    if (pago > 0.005) {
      return 'parcial';
    }
    // Saldo aberto integral → cai na decisão por data abaixo
  } else {
    // Sem informação de valores → último recurso, respeita "parcial" do ERP
    // (única classificação que não dá para inferir só de datas).
    if (statusLower === 'parcial') return 'parcial';
    // Sem valores e sem status confiável: fallback legado por data_pagamento
    // (apenas quando NÃO sabemos o saldo — não derruba telas que ainda não
    // foram migradas para passar valor_aberto/valor_pago).
    if (dataPagamento && (statusLower === 'pago' || statusLower === 'recebido')) {
      return 'pago';
    }
  }

  // 2) Decisão por data de vencimento (saldo ainda em aberto).
  if (!dataVencimento) {
    return 'pendente';
  }

  const hoje = getToday();
  const vencimento = parseLocalDate(dataVencimento);
  if (!vencimento) {
    return 'pendente';
  }
  vencimento.setHours(0, 0, 0, 0);

  if (vencimento < hoje) {
    return 'vencido';
  }
  return 'pendente';
}

// Hook para processar lista de contas com status calculado
export function useCalculatedFinancialStatus<T extends {
  data_vencimento?: string | null;
  data_pagamento?: string | null;
  data_recebimento?: string | null;
  status?: string | null;
  valor_aberto?: number | null;
  valor_pago?: number | null;
  valor_recebido?: number | null;
}>(contas: T[] | undefined): (T & { statusCalculado: string })[] {
  return useMemo(() => {
    if (!contas) return [];

    return contas.map(conta => ({
      ...conta,
      statusCalculado: calculateFinancialStatus(
        conta.data_vencimento,
        conta.data_pagamento || conta.data_recebimento,
        conta.status || undefined,
        conta.valor_aberto,
        conta.valor_pago ?? conta.valor_recebido,
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
