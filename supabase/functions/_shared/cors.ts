// _shared/cors.ts — CORS lockdown helper (SEG-3)

const DEFAULT_ALLOWED_ORIGINS = [
  "https://bimaster.lovable.app",
  "https://id-preview--4950000c-e035-4af2-9da5-1b55ef394745.lovable.app",
];

const STANDARD_HEADERS = "authorization, x-client-info, apikey, content-type, x-api-key, x-idempotency-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

/**
 * Returns CORS headers with origin validation.
 * Server-to-server calls (origin=null) are allowed for webhooks.
 * Unknown browser origins get empty Allow-Origin (browser blocks it).
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");

  // Server-to-server (webhooks, cron, n8n) — no origin header
  if (!origin) {
    return {
      "Access-Control-Allow-Headers": STANDARD_HEADERS,
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    };
  }

  const envOrigins = Deno.env.get("ALLOWED_ORIGINS");
  const allowedList = envOrigins
    ? envOrigins.split(",").map((o) => o.trim())
    : DEFAULT_ALLOWED_ORIGINS;

  const allowed = allowedList.includes(origin);

  return {
    "Access-Control-Allow-Origin": allowed ? origin : "",
    "Access-Control-Allow-Headers": STANDARD_HEADERS,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    ...(allowed ? { "Vary": "Origin" } : {}),
  };
}

/**
 * Handle OPTIONS preflight. Returns Response or null if not OPTIONS.
 */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  return null;
}
