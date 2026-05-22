/**
 * Normaliza um texto para comparação:
 * - remove acentos
 * - lowercase
 * - remove pontuação
 * - colapsa espaços
 */
export function normalizeText(s: string | null | undefined): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Chave canônica de agrupamento de insumo: descrição normalizada + fornecedor normalizado. */
export function insumoKey(nome: string | null | undefined, fornecedor: string | null | undefined): string {
  return `${normalizeText(stripQuantidade(nome))}||${normalizeText(fornecedor)}`;
}

/** Remove sufixos de quantidade tipo " (×1)" / " (x 12)" que poluem nomes vindos de composições. */
export function stripQuantidade(s: string | null | undefined): string {
  return (s || "").replace(/\s*\(\s*[×x]\s*\d+(?:[.,]\d+)?\s*\)\s*$/i, "").trim();
}

/** Formata um enum técnico (snake_case) em label legível. Ex.: "importado_kit" -> "Importado kit". */
export function prettifyEnum(s: string | null | undefined): string {
  const t = (s || "").trim();
  if (!t || t === "—") return t || "—";
  const lower = t.replace(/[_-]+/g, " ").toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
