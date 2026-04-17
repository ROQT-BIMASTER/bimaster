// _shared/response.ts — Unified response helpers (OBS-1 + P1 + P7)
import { getCorsHeaders } from "./cors.ts";
import { withSecurityHeaders } from "./security-headers.ts";

/**
 * Endpoints de escrita financeira que ainda NÃO suportam idempotência server-side.
 * Flag temporária X-Feature-Idempotency: not-yet-implemented sinaliza a integradores
 * que o header Idempotency-Key (já enviado pelo SDK) é ignorado.
 *
 * Removido em PR-2 quando _shared/idempotency.ts middleware estiver pronto.
 */
const IDEMPOTENCY_PENDING_PATHS = [
  "/contas-receber-api/incluir",
  "/contas-receber-api/baixar",
  "/contas-receber-api/cancelar",
  "/contas-pagar-api/incluir",
  "/contas-pagar-api/baixar",
  "/contas-pagar-api/cancelar",
  "/erp-export-payment",
  "/parcelas-api/incluir",
  "/contas-pagar-api/trigger-n8n",
];

/**
 * P1 — Extrai X-Request-ID do header (echo) ou gera novo UUID.
 * Aceita também x-correlation-id como fallback de fontes upstream (Cloudflare, n8n).
 */
function getOrCreateRequestId(req: Request): string {
  return (
    req.headers.get("x-request-id") ||
    req.headers.get("x-correlation-id") ||
    crypto.randomUUID()
  );
}

/**
 * P1.flag — Detecta se a request foi para um endpoint de escrita financeira
 * que ainda não tem idempotência server-side implementada.
 */
function isIdempotencyPending(req: Request): boolean {
  try {
    const url = new URL(req.url);
    return IDEMPOTENCY_PENDING_PATHS.some((p) => url.pathname.endsWith(p));
  } catch {
    return false;
  }
}

/**
 * Build a JSON response with CORS, security headers, X-Request-ID e metadata.
 */
export function jsonResponse(
  body: unknown,
  status: number,
  req: Request,
  options?: { startMs?: number; sensitive?: boolean }
): Response {
  const requestId = getOrCreateRequestId(req);
  const cors = getCorsHeaders(req);

  const baseHeaders: Record<string, string> = {
    ...cors,
    "Content-Type": "application/json",
    "X-Request-ID": requestId,
  };

  // P1.flag — sinaliza idempotência pendente para endpoints de escrita financeira
  if (isIdempotencyPending(req)) {
    baseHeaders["X-Feature-Idempotency"] = "not-yet-implemented";
  }

  const headers = withSecurityHeaders(
    baseHeaders,
    options?.sensitive ?? (status === 401 || status === 403)
  );

  const meta: Record<string, unknown> = {
    processed_at: new Date().toISOString(),
    request_id: requestId, // P7 — cascata para body
  };
  if (options?.startMs) {
    meta.duration_ms = Date.now() - options.startMs;
  }

  const responseBody =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? { ...(body as Record<string, unknown>), meta }
      : { data: body, meta };

  return new Response(JSON.stringify(responseBody), { status, headers });
}

/**
 * Build a standardized error response. Error envelope SEMPRE inclui request_id
 * tanto no header (X-Request-ID) quanto no body (campo request_id e em meta.request_id).
 */
export function errorResponse(
  status: number,
  code: string,
  message: string,
  req: Request,
  startMs?: number
): Response {
  const requestId = getOrCreateRequestId(req);
  // request_id é injetado no body para suporte (integrador cita o ID em ticket)
  return jsonResponse(
    { error: code, message, request_id: requestId },
    status,
    req,
    { startMs, sensitive: true }
  );
}
