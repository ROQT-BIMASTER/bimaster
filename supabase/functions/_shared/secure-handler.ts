// _shared/secure-handler.ts — Unified security pipeline for all Edge Functions
import { getCorsHeaders, handleCors } from "./cors.ts";
import { wafCheck, wafBlockResponse } from "./waf.ts";
import { withSecurityHeaders } from "./security-headers.ts";
import { validateJWT, validateApiKey, validateAnyAuth, AuthError } from "./auth.ts";
import { checkRateLimit, RateLimitError } from "./rate-limit.ts";
import { securityCheck } from "./security-middleware.ts";
import { applyRateLimitHeaders } from "./response.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Cache de quarentena em memória (TTL 5s) — reduzido de 30s para minimizar
// janela onde uma conta acabou de ser quarentenada mas requests ainda passam.
const QUARANTINE_TTL_MS = 5_000;
const quarantineCache = new Map<string, { value: boolean; expires: number }>();

async function isAccountQuarantined(userId: string): Promise<boolean> {
  const now = Date.now();
  const cached = quarantineCache.get(userId);
  if (cached && cached.expires > now) return cached.value;
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data } = await sb.rpc("is_account_quarantined", { _user_id: userId });
    const v = !!data;
    quarantineCache.set(userId, { value: v, expires: now + QUARANTINE_TTL_MS });
    return v;
  } catch {
    return false; // fail-open para não derrubar a aplicação se RPC falhar
  }
}

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
  /** Step-up scope required (e.g. 'export.data'). Token deve vir em X-Step-Up-Token. */
  requireStepUp?: string;
  /** Exigir MFA enrolled+verified para esta função (além do enforce de role). */
  requireMfa?: boolean;
  /** Permite que endpoints de cadastro/verificação MFA rodem mesmo quando o usuário já está em enforcement. */
  skipMfaEnforcement?: boolean;
  /**
   * Comportamento quando a verificação de MFA enforcement falha (RPC indisponível).
   * - "open" (default): segue request — preserva disponibilidade.
   * - "closed": retorna 503 — usar em endpoints críticos (Finance/Admin sensíveis).
   */
  mfaFailMode?: "open" | "closed";
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
        // Quarentena de conta — bloqueio imediato
        const quar = await isAccountQuarantined(result.userId);
        if (quar) {
          const headers = withSecurityHeaders(
            { ...corsHeaders, "Content-Type": "application/json" },
            true
          );
          return new Response(
            JSON.stringify({ error: "Conta em quarentena. Contate o administrador." }),
            { status: 423, headers }
          );
        }
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

      // 3b. MFA enforcement (admin/gerente após grace period)
      if (ctx.userId && !config.skipMfaEnforcement && (config.requireMfa || true)) {
        try {
          const sb = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          );
          const { data: enforced } = await sb.rpc("mfa_is_enforced_for_user", { _user_id: ctx.userId });
          if (enforced === true) {
            const headers = withSecurityHeaders(
              { ...corsHeaders, "Content-Type": "application/json" },
              true
            );
            return new Response(
              JSON.stringify({
                error: "MFA obrigatório. Período de carência expirado. Inscreva-se em /dashboard/security/mfa.",
                code: "MFA_REQUIRED",
              }),
              { status: 403, headers }
            );
          }
        } catch (e) {
          // Fail-mode configurável: "closed" bloqueia em caso de falha de verificação
          // (RPC indisponível). Padrão "open" preserva disponibilidade.
          if (config.mfaFailMode === "closed") {
            console.error(`[${config.rateLimitPrefix}] MFA check failed (fail-closed):`, e);
            const headers = withSecurityHeaders(
              { ...corsHeaders, "Content-Type": "application/json" },
              true
            );
            return new Response(
              JSON.stringify({
                error: "Verificação de MFA indisponível no momento. Tente novamente em instantes.",
                code: "MFA_CHECK_UNAVAILABLE",
              }),
              { status: 503, headers }
            );
          }
          /* fail-open na verificação */
        }
      }

      // 3c. Step-up enforcement
      if (config.requireStepUp && ctx.userId) {
        const token = req.headers.get("x-step-up-token");
        if (!token) {
          const headers = withSecurityHeaders(
            { ...corsHeaders, "Content-Type": "application/json" },
            true
          );
          return new Response(
            JSON.stringify({
              error: "Step-up obrigatório para esta ação.",
              code: "STEP_UP_REQUIRED",
              scope: config.requireStepUp,
            }),
            { status: 401, headers }
          );
        }
        try {
          const sb = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          );
          const { data: valid } = await sb.rpc("mfa_step_up_validate", {
            _user_id: ctx.userId,
            _scope: config.requireStepUp,
            _token: token,
          });
          if (!valid) {
            const headers = withSecurityHeaders(
              { ...corsHeaders, "Content-Type": "application/json" },
              true
            );
            return new Response(
              JSON.stringify({ error: "Token de step-up inválido ou expirado.", code: "STEP_UP_INVALID" }),
              { status: 401, headers }
            );
          }
        } catch {
          const headers = withSecurityHeaders(
            { ...corsHeaders, "Content-Type": "application/json" },
            true
          );
          return new Response(
            JSON.stringify({ error: "Falha ao validar step-up.", code: "STEP_UP_ERROR" }),
            { status: 500, headers }
          );
        }
      }

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

      // 6. Inject security + CORS headers into response
      const sensitive = response.status === 401 || response.status === 403;
      const secHeaders = withSecurityHeaders({}, sensitive);
      const newHeaders = new Headers(response.headers);
      for (const [k, v] of Object.entries(secHeaders)) {
        if (!newHeaders.has(k)) newHeaders.set(k, v);
      }
      // Always merge CORS headers so browser-origin callers receive
      // Access-Control-Allow-Origin on success responses too.
      for (const [k, v] of Object.entries(corsHeaders)) {
        if (!newHeaders.has(k)) newHeaders.set(k, v);
      }

      const finalResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });

      // PR-6: injeta RateLimit-{Limit,Remaining,Reset} (universal cobertura via secureHandler).
      return applyRateLimitHeaders(req, finalResponse);
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
        const meta = error.metadata;
        const rateHeaders: Record<string, string> = { ...headers, "Retry-After": "60" };
        if (meta) {
          rateHeaders["RateLimit-Limit"] = String(meta.limit);
          rateHeaders["RateLimit-Remaining"] = String(meta.remaining);
          rateHeaders["RateLimit-Reset"] = String(meta.reset);
        }
        return new Response(JSON.stringify({ error: error.message }), {
          status: 429,
          headers: rateHeaders,
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
