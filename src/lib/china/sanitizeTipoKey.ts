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
