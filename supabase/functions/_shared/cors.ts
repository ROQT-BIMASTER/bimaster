// _shared/cors.ts — CORS lockdown helper (SEG-3)

const DEFAULT_ALLOWED_ORIGINS = [
  "https://bimaster.online",
  "https://www.bimaster.online",
  "https://bimaster.lovable.app",
  "https://id-preview--4950000c-e035-4af2-9da5-1b55ef394745.lovable.app",
];

const STANDARD_HEADERS = "authorization, x-client-info, apikey, content-type, x-api-key, x-idempotency-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";
const LOVABLE_ORIGIN_REGEX = /^https:\/\/([a-z0-9-]+\.)*(lovable\.(app|dev)|lovableproject\.com)$/i;

function buildAllowedHeaders(req: Request): string {
  const requestedHeaders = req.headers.get("access-control-request-headers");
  if (!requestedHeaders) return STANDARD_HEADERS;

  const base = STANDARD_HEADERS.split(",").map((h) => h.trim().toLowerCase());
  const requested = requestedHeaders
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set([...base, ...requested])).join(", ");
}

/**
 * Returns CORS headers with origin validation.
 * Server-to-server calls (origin=null) are allowed for webhooks.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowHeaders = buildAllowedHeaders(req);

  // Server-to-server (webhooks, cron, n8n) — no origin header
  if (!origin) {
    return {
      "Access-Control-Allow-Headers": allowHeaders,
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    };
  }

  const envOrigins = Deno.env.get("ALLOWED_ORIGINS");
  const allowedList = envOrigins
    ? envOrigins.split(",").map((o) => o.trim())
    : DEFAULT_ALLOWED_ORIGINS;

  const allowed = allowedList.includes(origin) || LOVABLE_ORIGIN_REGEX.test(origin);

  return {
    "Access-Control-Allow-Origin": allowed ? origin : "",
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
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
