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

// ─────────────────────────────────────────────────────────────────────────────
// PR-5 — ETag / If-None-Match (RFC 7232)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remove campos voláteis (timestamps, durações, request_id) antes de hashear.
 * Garante ETag estável entre chamadas idênticas.
 */
function stripVolatileMeta(body: unknown): unknown {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return body;
  const clone = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;
  if (clone.meta && typeof clone.meta === "object" && !Array.isArray(clone.meta)) {
    const meta = clone.meta as Record<string, unknown>;
    delete meta.processed_at;
    delete meta.duration_ms;
    delete meta.request_id;
    if (Object.keys(meta).length === 0) delete clone.meta;
  }
  // Campos de topo voláteis comuns
  delete clone.timestamp;
  delete clone.request_id;
  return clone;
}

async function sha256Short(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hashBuf));
  // 16 hex chars (~64 bits) — colisão desprezível para cache de resposta HTTP
  return bytes.slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * jsonResponse com ETag estável + suporte a If-None-Match → 304.
 *
 * Use em GETs idempotentes (consultar/listar/status). O hash é calculado
 * sobre o body **sem** campos voláteis (meta.processed_at, duration_ms,
 * request_id) para garantir que a mesma consulta sempre produza a mesma ETag.
 */
export async function jsonResponseWithETag(
  body: unknown,
  status: number,
  req: Request,
  options?: { startMs?: number; sensitive?: boolean }
): Promise<Response> {
  const stable = stripVolatileMeta(body);
  const etag = `"${await sha256Short(JSON.stringify(stable))}"`;
  const ifNoneMatch = req.headers.get("if-none-match");

  // Cache hit — cliente já tem versão atual
  if (ifNoneMatch && ifNoneMatch === etag) {
    const cors = getCorsHeaders(req);
    const requestId = getOrCreateRequestId(req);
    const headers = withSecurityHeaders(
      {
        ...cors,
        "ETag": etag,
        "X-Request-ID": requestId,
        "Cache-Control": "private, must-revalidate",
      },
      false
    );
    return new Response(null, { status: 304, headers });
  }

  // Cache miss — devolve body completo + ETag para o cliente armazenar
  const res = jsonResponse(body, status, req, options);
  const headers = new Headers(res.headers);
  headers.set("ETag", etag);
  headers.set("Cache-Control", "private, must-revalidate");
  return new Response(res.body, { status: res.status, headers });
}

// ─────────────────────────────────────────────────────────────────────────────
// PR-5 — Interceptor por path: aplica ETag automaticamente em GETs idempotentes
// ─────────────────────────────────────────────────────────────────────────────

interface EtagEntry {
  /** path suffix (ex: "/listar") */
  suffix: string;
  /** API base path */
  api: "contas-pagar-api" | "contas-receber-api" | "parcelas-api";
}

/**
 * 6 GETs idempotentes (read-only) que ganham ETag/304:
 *  - CR: /status, /consultar, /listar
 *  - CP: /status, /consultar, /listar
 *
 * NOTA: parcelas-api/listar é POST por design legado — fica fora do escopo ETag
 * (304 só faz sentido em GET idempotente). Restam 6 GETs efetivos.
 */
const ETAG_ENTRIES: EtagEntry[] = [
  { suffix: "/status",    api: "contas-receber-api" },
  { suffix: "/consultar", api: "contas-receber-api" },
  { suffix: "/listar",    api: "contas-receber-api" },
  { suffix: "/status",    api: "contas-pagar-api" },
  { suffix: "/consultar", api: "contas-pagar-api" },
  { suffix: "/listar",    api: "contas-pagar-api" },
];

/**
 * Reescreve uma Response com ETag estável + suporte a 304 If-None-Match,
 * **somente** para GETs em paths registrados em ETAG_ENTRIES.
 *
 * Uso (no roteador):
 *   const res = await handler(ctx);
 *   return await applyETagByPath(req, res);
 */
export async function applyETagByPath(req: Request, res: Response): Promise<Response> {
  if (req.method.toUpperCase() !== "GET") return res;
  if (res.status !== 200) return res;
  let matched = false;
  try {
    const url = new URL(req.url);
    const path = url.pathname;
    for (const entry of ETAG_ENTRIES) {
      if (path.endsWith(entry.suffix) && path.includes(`/${entry.api}`)) {
        matched = true;
        break;
      }
    }
  } catch {
    return res;
  }
  if (!matched) return res;

  let bodyText: string;
  try {
    bodyText = await res.clone().text();
  } catch {
    return res;
  }
  if (!bodyText) return res;

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return res;
  }

  const stable = stripVolatileMeta(parsed);
  const etag = `"${await sha256Short(JSON.stringify(stable))}"`;
  const ifNoneMatch = req.headers.get("if-none-match");

  if (ifNoneMatch && ifNoneMatch === etag) {
    const cors = getCorsHeaders(req);
    const requestId = getOrCreateRequestId(req);
    const headers = withSecurityHeaders(
      {
        ...cors,
        "ETag": etag,
        "X-Request-ID": requestId,
        "Cache-Control": "private, must-revalidate",
      },
      false
    );
    return new Response(null, { status: 304, headers });
  }

  const headers = new Headers(res.headers);
  headers.set("ETag", etag);
  headers.set("Cache-Control", "private, must-revalidate");
  return new Response(bodyText, { status: res.status, statusText: res.statusText, headers });
}
