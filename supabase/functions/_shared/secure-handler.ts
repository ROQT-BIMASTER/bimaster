// _shared/secure-handler.ts — Unified security pipeline for all Edge Functions
import { getCorsHeaders, handleCors } from "./cors.ts";
import { wafCheck, wafBlockResponse } from "./waf.ts";
import { withSecurityHeaders } from "./security-headers.ts";
import { validateJWT, validateApiKey, validateAnyAuth, AuthError } from "./auth.ts";
import { checkRateLimit, RateLimitError } from "./rate-limit.ts";
import { securityCheck } from "./security-middleware.ts";

export interface SecureContext {
  userId?: string;
  email?: string;
  empresaId?: string;
  authSource?: "jwt" | "api_key";
}

export interface SecureHandlerConfig {
  /** Authentication mode */
  auth: "jwt" | "apikey" | "any" | "none";
  /** Max requests per minute (0 = disabled) */
  rateLimit?: number;
  /** Rate limit key prefix */
  rateLimitPrefix: string;
  /** Skip WAF for this function (e.g. functions that receive binary/html) */
  skipWaf?: boolean;
}

type Handler = (req: Request, ctx: SecureContext) => Promise<Response>;

/**
 * Wraps an Edge Function handler with the full security pipeline:
 * 1. CORS preflight
 * 2. WAF L7 inspection
 * 3. Authentication (JWT / API Key / Any / None)
 * 4. Rate Limiting
 * 5. Business logic
 * 6. Security headers on all responses
 */
export function secureHandler(config: SecureHandlerConfig, handler: Handler) {
  return async (req: Request): Promise<Response> => {
    // 1. CORS preflight
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    const corsHeaders = getCorsHeaders(req);

    try {
      // 2. WAF L7
      if (!config.skipWaf) {
        const wafResult = await wafCheck(req);
        if (!wafResult.allowed) {
          return wafBlockResponse(wafResult, corsHeaders);
        }
      }

      // 2b. IP Blocklist enforcement
      const secStatus = await securityCheck(req);
      if (!secStatus.allowed) {
        const headers = withSecurityHeaders(
          { ...corsHeaders, "Content-Type": "application/json" },
          true
        );
        return new Response(
          JSON.stringify({ error: secStatus.reason || "Acesso bloqueado" }),
          { status: 403, headers }
        );
      }

      // 3. Authentication
      const ctx: SecureContext = {};

      if (config.auth === "jwt") {
        const result = await validateJWT(req);
        ctx.userId = result.userId;
        ctx.email = result.email;
        ctx.authSource = "jwt";
      } else if (config.auth === "apikey") {
        const result = await validateApiKey(req);
        ctx.empresaId = result.empresaId;
        ctx.authSource = "api_key";
      } else if (config.auth === "any") {
        const result = await validateAnyAuth(req);
        ctx.userId = result.userId;
        ctx.email = result.email;
        ctx.empresaId = result.empresaId;
        ctx.authSource = result.source;
      }
      // auth === "none" — skip

      // 4. Rate Limiting
      const limit = config.rateLimit ?? 60;
      if (limit > 0) {
        await checkRateLimit({
          prefix: config.rateLimitPrefix,
          limit,
          req,
          userId: ctx.userId,
        });
      }

      // 5. Execute handler
      const response = await handler(req, ctx);

      // 6. Inject security headers into response
      const sensitive = response.status === 401 || response.status === 403;
      const secHeaders = withSecurityHeaders({}, sensitive);
      const newHeaders = new Headers(response.headers);
      for (const [k, v] of Object.entries(secHeaders)) {
        if (!newHeaders.has(k)) newHeaders.set(k, v);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (error) {
      // Unified error handling
      const sensitive = true;
      const headers = withSecurityHeaders(
        { ...corsHeaders, "Content-Type": "application/json" },
        sensitive
      );

      if (error instanceof AuthError) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: error.status,
          headers,
        });
      }

      if (error instanceof RateLimitError) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 429,
          headers: { ...headers, "Retry-After": "60" },
        });
      }

      const message = error instanceof Error ? error.message : "Erro interno";
      console.error(`[${config.rateLimitPrefix}] Error:`, error);
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers,
      });
    }
  };
}
