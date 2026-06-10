/**
 * Conversões de data padronizadas no fuso horário Brasil (America/Sao_Paulo).
 *
 * Política do sistema (vale para qualquer país onde o banco esteja hospedado):
 * - Leitura de coluna Postgres DATE  → `parseLocalDate`
 * - Escrita em coluna Postgres DATE  → `formatLocalDate`
 * - "Agora" em coluna timestamptz    → `nowSaoPauloISO`
 *
 * NUNCA usar `new Date("YYYY-MM-DD")` ou `d.toISOString().split("T")[0]` para
 * colunas DATE — ambos produzem shift UTC e gravam o dia anterior em SP.
 */

/**
 * Converte uma string de data do Postgres em Date local, sem shift de timezone.
 *
 * Strings no formato "YYYY-MM-DD" (tipo `DATE` do Postgres) são interpretadas
 * pelo construtor `new Date(string)` como UTC midnight. Em fusos negativos
 * (ex.: America/Sao_Paulo, UTC-3), isso desloca a data para o dia anterior,
 * quebrando comparações como `isToday`, `isBefore` e `isWithinInterval`.
 *
 * Este helper retorna uma Date com meia-noite no fuso LOCAL do navegador.
 *
 * Para timestamps com hora ("YYYY-MM-DDTHH:mm:ss..."), faz fallback para
 * `new Date(s)` que respeita o offset embutido na string.
 */
export function parseLocalDate(s: string | Date | null | undefined): Date | null {
  if (!s) return null;
  if (s instanceof Date) return s;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(s);
}

/**
 * Versão non-null: retorna `new Date()` quando a entrada é vazia.
 * Use apenas quando você TEM CERTEZA que o valor existe (já filtrado antes).
 */
export function parseLocalDateOrNow(s: string | Date | null | undefined): Date {
  return parseLocalDate(s) ?? new Date();
}

/**
 * Formata uma `Date` em string `YYYY-MM-DD` usando os componentes LOCAIS
 * (ano/mês/dia do fuso do navegador), próprio para gravação em coluna
 * Postgres `DATE`. NUNCA usar `d.toISOString().split("T")[0]` — ISO usa UTC
 * e em SP (UTC-3) o usuário que seleciona "02 jun" às 21h grava "03 jun".
 */
export function formatLocalDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const SAO_PAULO_TZ = "America/Sao_Paulo";

/**
 * Retorna o instante atual como ISO string com offset explícito de
 * São Paulo (ex.: `2026-06-08T14:32:11.000-03:00`), independentemente
 * do timezone do servidor/banco. Use em colunas `timestamptz` quando o
 * "agora" precisa refletir o fuso Brasil (auditoria, data_conclusao
 * registrada manualmente em update etc.).
 */
export function nowSaoPauloISO(date: Date = new Date()): string {
  // Extrai partes no TZ de SP via Intl
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: SAO_PAULO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  // Offset de SP: -02:00 no horário de verão (não vigente desde 2019) ou -03:00 padrão.
  // Detecta dinamicamente comparando o "wall time" de SP com o UTC do mesmo instante.
  const utcWall = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? "00" : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const diffMin = Math.round((utcWall - date.getTime()) / 60000);
  const sign = diffMin >= 0 ? "+" : "-";
  const abs = Math.abs(diffMin);
  const offH = String(Math.floor(abs / 60)).padStart(2, "0");
  const offM = String(abs % 60).padStart(2, "0");
  const hh = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hh}:${parts.minute}:${parts.second}.${ms}${sign}${offH}:${offM}`;
}

/**
 * Atalho: data de hoje no fuso Brasil em formato `YYYY-MM-DD` para colunas DATE.
 */
export function todayBR(): string {
  const nowSp = nowSaoPauloISO();
  // "YYYY-MM-DD" é os primeiros 10 chars do ISO em wall-time de SP
  return nowSp.slice(0, 10);
}

/**
 * Re-export canônico de `getToday` (definido em `@/utils/dateUtils`).
 * Retorna meia-noite de HOJE no fuso `America/Sao_Paulo`, independente
 * do fuso do navegador/servidor. Use sempre que precisar de "agora normalizado
 * ao início do dia" para comparações com `data_prazo` / `data_conclusao`.
 */
export { getToday } from "@/utils/dateUtils";

/**
 * Hora atual (0–23) no fuso `America/Sao_Paulo`. Usar para saudações
 * "Bom dia / Boa tarde / Boa noite" sem depender do fuso do navegador.
 */
export function getCurrentHourBR(date: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: SAO_PAULO_TZ,
    hour: "2-digit",
    hour12: false,
  });
  const value = fmt.format(date);
  // Intl pode devolver "24" para meia-noite em alguns runtimes — normaliza.
  const h = Number(value === "24" ? "0" : value);
  return Number.isFinite(h) ? h : new Date(date).getHours();
}
