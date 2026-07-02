import { formatCurrency } from "@/lib/formatters";

/** "R$ 11,6 mi", "R$ 340 mil", ou moeda completa para valores pequenos. */
export function formatMi(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(0)} mil`;
  return formatCurrency(v);
}

/** "+87%" / "-19%" / "—" para nulos/infinitos. */
export function formatVarPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const pct = n * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

export type VariacaoTone = "positivo" | "negativo" | "neutro";

export function variacaoTone(n: number | null | undefined): VariacaoTone {
  if (n == null || !Number.isFinite(n)) return "neutro";
  if (n > 0.005) return "positivo";
  if (n < -0.005) return "negativo";
  return "neutro";
}
