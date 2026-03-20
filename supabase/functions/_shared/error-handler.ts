// _shared/error-handler.ts — Unified error response builder (SEG + ADV)
import { AuthError } from "./auth.ts";
import { RateLimitError } from "./rate-limit.ts";
import { ValidationError } from "./validate.ts";
import { SSRFError } from "./ssrf-guard.ts";
import { withSecurityHeaders } from "./security-headers.ts";

/**
 * Convert any error into a proper JSON Response with CORS + security headers.
 */
export function handleError(error: unknown, corsHeaders: Record<string, string>): Response {
  console.error("Edge function error:", error);

  const headers = withSecurityHeaders(corsHeaders, true);

  if (error instanceof AuthError) {
    return jsonResponse({ error: error.message }, error.status, headers);
  }

  if (error instanceof RateLimitError) {
    return jsonResponse(
      { error: error.message },
      429,
      { ...headers, "Retry-After": "60" }
    );
  }

  if (error instanceof ValidationError) {
    return jsonResponse(
      { error: "payload_invalido", details: error.issues },
      400,
      headers
    );
  }

  if (error instanceof SSRFError) {
    return jsonResponse(
      { error: error.message },
      400,
      headers
    );
  }

  const message = error instanceof Error ? error.message : "Erro interno";
  return jsonResponse({ error: message }, 500, headers);
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
