// _shared/error-handler.ts — Unified error response builder
import { AuthError } from "./auth.ts";
import { RateLimitError } from "./rate-limit.ts";
import { ValidationError } from "./validate.ts";

/**
 * Convert any error into a proper JSON Response with CORS headers.
 */
export function handleError(error: unknown, corsHeaders: Record<string, string>): Response {
  console.error("Edge function error:", error);

  if (error instanceof AuthError) {
    return jsonResponse({ error: error.message }, error.status, corsHeaders);
  }

  if (error instanceof RateLimitError) {
    return jsonResponse(
      { error: error.message },
      429,
      { ...corsHeaders, "Retry-After": "60" }
    );
  }

  if (error instanceof ValidationError) {
    return jsonResponse(
      { error: "payload_invalido", details: error.issues },
      400,
      corsHeaders
    );
  }

  const message = error instanceof Error ? error.message : "Erro interno";
  return jsonResponse({ error: message }, 500, corsHeaders);
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
