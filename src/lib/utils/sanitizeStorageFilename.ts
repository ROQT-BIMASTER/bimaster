/**
 * Sanitiza o nome de um arquivo para uso como key no Supabase Storage.
 *
 * Storage rejeita keys com caracteres não-ASCII (acentos, ç, parênteses, etc.),
 * o que faz uploads de arquivos como "Apresentação Ruby Rose (1).pdf" falharem
 * com "Invalid key".
 *
 * O nome original do arquivo continua sendo exibido na UI — só o `storage_path`
 * é sanitizado.
 */
export function sanitizeStorageFilename(filename: string): string {
  // Separa extensão preservando-a
  const lastDot = filename.lastIndexOf(".");
  const base = lastDot > 0 ? filename.slice(0, lastDot) : filename;
  const ext = lastDot > 0 ? filename.slice(lastDot) : "";

  const cleanBase = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacríticos
    .replace(/[^a-zA-Z0-9._-]+/g, "_") // qualquer outra coisa vira _
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const cleanExt = ext
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.]+/g, "");

  const safe = `${cleanBase || "arquivo"}${cleanExt}`;
  // Storage tem limite de ~1024 chars no path; um nome longo é raro mas trunca por segurança.
  return safe.slice(0, 200);
}
