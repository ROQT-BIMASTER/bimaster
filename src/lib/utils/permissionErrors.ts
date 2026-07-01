/**
 * Detecta erros de RLS/permissão vindos do backend e devolve uma
 * mensagem amigável e um flag `isPermissionError`.
 *
 * Postgres retorna:
 *  - code "42501" — permission denied
 *  - message contendo "row-level security" / "violates row-level security"
 *  - PostgREST devolve status 401/403 quando não autenticado ou sem role
 */
export function isPermissionError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as any;
  const code = String(anyErr?.code ?? "");
  const status = Number(anyErr?.status ?? anyErr?.statusCode ?? 0);
  const msg = String(anyErr?.message ?? anyErr ?? "").toLowerCase();
  if (code === "42501") return true;
  if (status === 401 || status === 403) return true;
  return (
    msg.includes("row-level security") ||
    msg.includes("row level security") ||
    msg.includes("permission denied") ||
    msg.includes("not authorized")
  );
}

export function toFriendlyPermissionMessage(
  err: unknown,
  fallback = "Falha ao processar a solicitação",
): string {
  if (isPermissionError(err)) {
    return "Você não tem permissão para acessar este conteúdo. Solicite acesso ao responsável ou a um administrador.";
  }
  const msg = (err as any)?.message;
  return typeof msg === "string" && msg.length > 0 ? msg : fallback;
}
