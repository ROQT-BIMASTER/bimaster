// _shared/response.ts — Unified response helpers (OBS-1 + P1 + P7 + PR-4 + PR-5 + PR-6)
import { getCorsHeaders } from "./cors.ts";
import { withSecurityHeaders } from "./security-headers.ts";

// ─────────────────────────────────────────────────────────────────────────────
// PR-4 — Deprecation / Sunset headers (RFC 8594 + draft-ietf-httpapi-deprecation)
// ─────────────────────────────────────────────────────────────────────────────

export interface DeprecationOptions {
  /** RFC 7231 IMF-fixdate, ex: "Wed, 30 Sep 2026 23:59:59 GMT" */
  sunset: string;
  /** URL/path do endpoint substituto (rel="successor-version") */
  successor?: string;
  /** doc explicativo (rel="deprecation") */
  link?: string;
}

/**
 * Adiciona Deprecation: true + Sunset + Link a uma Response existente.
 * Não modifica o body — apenas headers.
 */
export function withDeprecation(res: Response, opts: DeprecationOptions): Response {
  const headers = new Headers(res.headers);
  headers.set("Deprecation", "true");
  headers.set("Sunset", opts.sunset);
  const linkParts: string[] = [];
  if (opts.successor) linkParts.push(`<${opts.successor}>; rel="successor-version"`);
  if (opts.link) linkParts.push(`<${opts.link}>; rel="deprecation"`);
  if (linkParts.length > 0) headers.set("Link", linkParts.join(", "));
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

/**
 * Mapa de paths legados → opções de deprecation.
 * Aplicado pelo interceptor `applyDeprecationByPath` em cada handler legado.
 *
 * 7 entradas confirmadas no inventário (alinhadas com ApiDocumentation.tsx):
 *  - CP: /registrar-pagamento, /alterar (PUT), /cancelar-pagamento, /listar
 *  - CR: /alterar (PUT), /cancelar-recebimento, /listar
 */
const DEFAULT_SUNSET = "Wed, 30 Sep 2026 23:59:59 GMT";
const DOCS_LINK = "https://bimaster.online/dashboard/erp-api-docs";

interface LegacyEntry {
  /** path suffix to match (ex: "/listar") */
  suffix: string;
  /** HTTP method (uppercase) */
  method: string;
  /** API base path (ex: "contas-pagar-api") used to build successor URL */
  api: "contas-pagar-api" | "contas-receber-api";
  /** successor path (ex: "/query") */
  successor: string;
}

const LEGACY_ENTRIES: LegacyEntry[] = [
  // contas-pagar-api
  { suffix: "/registrar-pagamento", method: "POST", api: "contas-pagar-api", successor: "/lancar-pagamento" },
  { suffix: "/alterar",             method: "PUT",  api: "contas-pagar-api", successor: "/upsert" },
  { suffix: "/cancelar-pagamento",  method: "POST", api: "contas-pagar-api", successor: "/estornar" },
  { suffix: "/listar",              method: "GET",  api: "contas-pagar-api", successor: "/query" },
  // contas-receber-api
  { suffix: "/alterar",             method: "PUT",  api: "contas-receber-api", successor: "/upsert" },
  { suffix: "/cancelar-recebimento",method: "POST", api: "contas-receber-api", successor: "/estornar" },
  { suffix: "/listar",              method: "GET",  api: "contas-receber-api", successor: "/query" },
];

/**
 * Interceptor automático: se o request casa com um path legado, aplica
 * Deprecation/Sunset/Link na response. Caso contrário, retorna response intacta.
 *
 * Uso (no roteador da API):
 *   const res = await handler(ctx);
 *   return applyDeprecationByPath(req, res);
 */
export function applyDeprecationByPath(req: Request, res: Response): Response {
  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method.toUpperCase();
    for (const entry of LEGACY_ENTRIES) {
      if (method !== entry.method) continue;
      if (!path.endsWith(entry.suffix)) continue;
      // Confirma que está dentro da API esperada (evita falsos positivos de outras funções)
      if (!path.includes(`/${entry.api}`)) continue;
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const successor = `${supabaseUrl}/functions/v1/${entry.api}${entry.successor}`;
      return withDeprecation(res, {
        sunset: DEFAULT_SUNSET,
        successor,
        link: DOCS_LINK,
      });
    }
  } catch {
    // Falha silenciosa — nunca derrubar resposta por causa de header opcional
  }
  return res;
}

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
