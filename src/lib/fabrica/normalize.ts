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
  return `${normalizeText(nome)}||${normalizeText(fornecedor)}`;
}
