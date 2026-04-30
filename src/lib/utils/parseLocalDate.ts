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
