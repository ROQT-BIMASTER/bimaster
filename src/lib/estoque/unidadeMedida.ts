/**
 * O ERP envia `unidade_medida` como número (quantidade por embalagem de venda).
 * Não há descrição textual na origem, então derivamos uma label legível.
 *
 * 1   → "Unitário (1 un)"
 * N>1 → "Embalagem c/ N un"
 */
export function formatUnidadeMedida(code: string | number | null | undefined): string {
  if (code == null || code === '') return '—';
  const raw = String(code).trim();
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return raw;
  if (n === 1) return 'Unitário (1 un)';
  return `Embalagem c/ ${n} un`;
}

/** Versão compacta para chips/atalhos. */
export function formatUnidadeMedidaShort(code: string | number | null | undefined): string {
  if (code == null || code === '') return '—';
  const raw = String(code).trim();
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return raw;
  if (n === 1) return '1 un';
  return `c/ ${n} un`;
}
