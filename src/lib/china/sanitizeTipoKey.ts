/**
 * Sanitiza um segmento para uso em path do Supabase Storage.
 * Storage rejeita chaves com caracteres não-ASCII ("Invalid key").
 *
 * - remove diacríticos (ó → o, ç → c, ã → a)
 * - substitui qualquer caractere fora de [A-Za-z0-9._-] por "_"
 * - colapsa "_" repetidos
 * - limita a 64 caracteres
 */
export function sanitizeStorageSegment(input: string): string {
  if (!input) return "_";
  const ascii = input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const trimmed = ascii.slice(0, 64);
  return trimmed.length > 0 ? trimmed : "_";
}

/**
 * Sanitiza um nome de arquivo para path do Storage preservando a extensão.
 * Nomes em chinês/japonês/árabe viram "_" e antes causavam "Invalid key".
 *
 *   "报告 最终.pdf" → "arquivo.pdf"
 *   "Relatório Final.PDF" → "Relatorio_Final.PDF"
 */
export function sanitizeStorageFileName(input: string): string {
  const raw = (input || "").trim();
  const lastDot = raw.lastIndexOf(".");
  const hasExt = lastDot > 0 && lastDot < raw.length - 1;
  const base = hasExt ? raw.slice(0, lastDot) : raw;
  const extRaw = hasExt ? raw.slice(lastDot + 1) : "";

  let safeBase = sanitizeStorageSegment(base);
  if (!safeBase || safeBase === "_") safeBase = "arquivo";

  const safeExt = extRaw.replace(/[^A-Za-z0-9]+/g, "").slice(0, 12);
  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}
