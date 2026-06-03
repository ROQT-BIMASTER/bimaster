/**
 * O ERP envia `unidade_medida` como número (quantidade por embalagem de venda).
 * Convertemos esse número para a sigla comercial usada pela distribuidora:
 *
 *   1                → UN  (Unidade)
 *   2 a 48           → BX  (Display / Box)
 *   acima de 48      → CX  (Caixa máster)
 *
 * Os limites seguem a prática da operação: displays comerciais raramente
 * passam de 48 itens; acima disso já é caixa máster.
 */
export type SiglaUnidade = 'UN' | 'BX' | 'CX';

export function siglaUnidadeMedida(code: string | number | null | undefined): SiglaUnidade | null {
  if (code == null || code === '') return null;
  const n = Number(code);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n === 1) return 'UN';
  if (n <= 48) return 'BX';
  return 'CX';
}

const NOMES: Record<SiglaUnidade, string> = {
  UN: 'Unidade',
  BX: 'Display',
  CX: 'Caixa',
};

/** Label completa: "1 — UN (Unidade)", "12 — BX (Display)", "96 — CX (Caixa)". */
export function formatUnidadeMedida(code: string | number | null | undefined): string {
  if (code == null || code === '') return '—';
  const sigla = siglaUnidadeMedida(code);
  if (!sigla) return String(code);
  const n = Number(code);
  return `${n} — ${sigla} (${NOMES[sigla]})`;
}

/** Versão compacta para chips/atalhos: "1 UN", "12 BX", "96 CX". */
export function formatUnidadeMedidaShort(code: string | number | null | undefined): string {
  if (code == null || code === '') return '—';
  const sigla = siglaUnidadeMedida(code);
  if (!sigla) return String(code);
  const n = Number(code);
  return `${n} ${sigla}`;
}
