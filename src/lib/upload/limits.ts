/**
 * Fonte única de verdade para o limite máximo de upload no sistema.
 *
 * ⚠️ NÃO duplique este valor em nenhum outro arquivo do front. Qualquer novo
 * validador, componente de UI, mensagem de erro ou telemetria DEVE importar
 * `UPLOAD_MAX_BYTES` (ou os helpers abaixo) daqui.
 *
 * O back-end (trigger `public.enforce_projeto_anexos_limits`) lê o mesmo
 * valor da função SQL `public.upload_max_bytes()` — se este número mudar,
 * atualize a função SQL na mesma migração para manter paridade.
 */

/** Limite unificado de upload por arquivo, em bytes (1 GB). */
export const UPLOAD_MAX_BYTES = 1024 * 1024 * 1024;

/** Rótulo legível ("1 GB") para mensagens de UI. */
export const UPLOAD_MAX_LABEL = "1 GB";

/** Retorna true se `bytes` está dentro do limite. */
export function isWithinUploadLimit(bytes: number): boolean {
  return bytes <= UPLOAD_MAX_BYTES;
}

/** Mensagem padrão de rejeição por tamanho excedido. */
export function uploadSizeExceededMessage(fileName?: string): string {
  const alvo = fileName ? `"${fileName}" ` : "";
  return `Arquivo ${alvo}excede o limite unificado de ${UPLOAD_MAX_LABEL} por arquivo.`;
}
