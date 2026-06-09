import type { EstoqueUnificadoRow } from '@/hooks/estoque/useEstoqueUnificado';

export type ModoExibicao = 'fisico' | 'cx' | 'bx' | 'un';

export const MODO_LABEL: Record<ModoExibicao, string> = {
  fisico: 'Físico (CX/BX/UN)',
  cx: 'Caixas (CX)',
  bx: 'Displays (BX)',
  un: 'Unidades (UN)',
};

export const MODO_COL_LABEL: Record<Exclude<ModoExibicao, 'fisico'>, string> = {
  cx: 'Total em CX',
  bx: 'Total em BX',
  un: 'Total em UN',
};

/**
 * Converte o saldo total em UN equivalente para a unidade do modo selecionado.
 * Retorna null quando o fator necessário não está disponível.
 */
export function converterParaModo(
  row: EstoqueUnificadoRow,
  modo: Exclude<ModoExibicao, 'fisico'>,
): number | null {
  const totalUn = Number(row.saldo_total_em_unidades || 0);
  if (modo === 'un') return totalUn;
  if (modo === 'cx') {
    const f = Number(row.fator_cx_para_un || 0);
    return f > 0 ? totalUn / f : null;
  }
  // bx
  const f = Number(row.fator_bx_para_un || 0);
  return f > 0 ? totalUn / f : null;
}

/**
 * Equivalente em caixas máster do TOTAL em UN (saldo bruto, sem abater bloqueado).
 */
export function equivalenteEmCaixas(row: EstoqueUnificadoRow): number | null {
  const totalUn = Number(row.saldo_total_em_unidades || 0);
  const f = Number(row.fator_cx_para_un || 0);
  return f > 0 ? totalUn / f : null;
}

/**
 * Equivalente em caixas máster do DISPONÍVEL (saldo − bloqueado).
 * É o número que importa para apoio a vendas/compras.
 */
export function disponivelEmCaixas(row: EstoqueUnificadoRow): number | null {
  const dispUn = Number(row.disponivel_total_em_unidades || 0);
  const f = Number(row.fator_cx_para_un || 0);
  return f > 0 ? dispUn / f : null;
}

export function formatCx(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
