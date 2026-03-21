// _shared/response.ts — Unified response helpers (OBS-1)
import { getCorsHeaders } from "./cors.ts";
import { withSecurityHeaders } from "./security-headers.ts";

/**
 * Build a JSON response with CORS, security headers, and metadata.
 */
export function jsonResponse(
  body: unknown,
  status: number,
  req: Request,
  options?: { startMs?: number; sensitive?: boolean }
): Response {
  const cors = getCorsHeaders(req);
  const headers = withSecurityHeaders(
    { ...cors, "Content-Type": "application/json" },
    options?.sensitive ?? (status === 401 || status === 403)
  );

  const meta: Record<string, unknown> = {
    processed_at: new Date().toISOString(),
  };
  if (options?.startMs) {
    meta.duration_ms = Date.now() - options.startMs;
  }

  const responseBody = typeof body === "object" && body !== null && !Array.isArray(body)
    ? { ...body as Record<string, unknown>, meta }
    : { data: body, meta };

  return new Response(JSON.stringify(responseBody), { status, headers });
}

/**
 * Build a standardized error response.
 */
export function errorResponse(
  status: number,
  code: string,
  message: string,
  req: Request,
  startMs?: number
): Response {
  return jsonResponse({ error: code, message }, status, req, { startMs, sensitive: true });
}
