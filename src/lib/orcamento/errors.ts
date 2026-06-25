/**
 * Extrai mensagem legível de erros do backend (PostgrestError, Error,
 * objetos genéricos). PostgrestError NÃO é instanceof Error, então o
 * padrão `e instanceof Error ? e.message : fallback` engole a mensagem
 * real do banco — use este helper nos toasts do módulo Orçamento.
 */
export function extractOrcamentoError(e: unknown, fallback: string): string {
  if (!e) return fallback;
  const err = e as {
    message?: string;
    details?: string;
    hint?: string;
    error_description?: string;
  };
  return (
    err.message ||
    err.details ||
    err.hint ||
    err.error_description ||
    fallback
  );
}
