import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";

/**
 * Formatação padrão de prazos/datas curtas em Projetos.
 *
 * Regra de produto: o ano só aparece quando a data NÃO é do ano corrente —
 * assim a lista continua enxuta no dia a dia, mas prazos de 2025/2027 deixam
 * de ser ambíguos (pedido recorrente dos usuários).
 *
 * Sempre usa `parseLocalDate` (colunas DATE do Postgres não podem passar por
 * `new Date("YYYY-MM-DD")`, que desloca o dia no fuso de São Paulo).
 */

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : parseLocalDate(value);
  if (!d || Number.isNaN(d.getTime())) return null;
  return d;
}

function isOtherYear(d: Date): boolean {
  return d.getFullYear() !== new Date().getFullYear();
}

/** "12 mar" no ano corrente; "12 mar 25" nos demais anos. */
export function formatPrazoCurto(value: string | Date | null | undefined, fallback = ""): string {
  const d = toDate(value);
  if (!d) return fallback;
  return format(d, isOtherYear(d) ? "dd MMM yy" : "dd MMM", { locale: ptBR });
}

/** "12/03" no ano corrente; "12/03/25" nos demais anos. */
export function formatPrazoNumerico(value: string | Date | null | undefined, fallback = "—"): string {
  const d = toDate(value);
  if (!d) return fallback;
  return format(d, isOtherYear(d) ? "dd/MM/yy" : "dd/MM", { locale: ptBR });
}

/** Sempre com ano completo — usado em tooltips e `aria-label`. */
export function formatPrazoCompleto(value: string | Date | null | undefined, fallback = "—"): string {
  const d = toDate(value);
  if (!d) return fallback;
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}
