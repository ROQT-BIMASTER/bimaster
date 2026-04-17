// _shared/rate-limit.ts — Global rate limiting (SEG-5 + PR-6)
import { createClient } from "npm:@supabase/supabase-js@2";

interface RateLimitOptions {
  /** Unique key prefix (e.g. "export-pdf", "ai-analytics") */
  prefix: string;
  /** Max requests per minute */
  limit: number;
  /** Request object to extract identifiers */
  req: Request;
  /** Optional user ID for authenticated requests */
  userId?: string;
}

/**
 * PR-6 — Metadata structured per RFC draft-ietf-httpapi-ratelimit-headers.
 * Retornada pela RPC v2 e cacheada em `rateLimitMetaCache` por Request.
 */
export interface RateLimitMetadata {
  /** janela máxima (req/min) */
  limit: number;
  /** quanto resta na janela atual */
  remaining: number;
  /** unix epoch (segundos) do início da próxima janela */
  reset: number;
}

/**
 * Cache de metadata por Request — preenchido por checkRateLimit, lido por
 * applyRateLimitHeaders (interceptor no roteador). WeakMap evita leak.
 */
const rateLimitMetaCache = new WeakMap<Request, RateLimitMetadata>();

export function getRateLimitMetadata(req: Request): RateLimitMetadata | undefined {
  return rateLimitMetaCache.get(req);
}

/**
 * Check rate limit using RPC v2 (PR-6: retorna metadata estruturada).
 * Fallback gracioso para v1 (boolean) se v2 não estiver disponível —
 * garante compat durante deploy escalonado.
 *
 * Throws RateLimitError com metadata quando excedido.
 */
export async function checkRateLimit(opts: RateLimitOptions): Promise<RateLimitMetadata | undefined> {
  const { prefix, limit, req, userId } = opts;

  // Build key from userId or IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const identifier = userId || ip;
  const key = `${prefix}-${identifier}`;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Check IP blocklist first
  if (ip !== "unknown") {
    const { data: blocked } = await supabase.rpc("is_ip_blocked", { p_ip: ip });
    if (blocked === true) {
      // Log blocked attempt
      await supabase.from("security_audit_log").insert({
        action: "blocked_by_blocklist",
        severity: "high",
        metadata: { ip, prefix, user_id: userId },
      }).catch(() => {});
      throw new RateLimitError();
    }
  }

  // PR-6: RPC v2 retorna { allowed, limit, remaining, reset_at }
  const { data: v2Data, error: v2Err } = await supabase.rpc(
    "check_and_increment_rate_limit_v2",
    { p_chave: key, p_limite: limit }
  );

  if (!v2Err && v2Data && typeof v2Data === "object") {
    const meta: RateLimitMetadata = {
      limit: Number((v2Data as any).limit ?? limit),
      remaining: Number((v2Data as any).remaining ?? 0),
      reset: Number((v2Data as any).reset_at ?? Math.floor(Date.now() / 1000) + 60),
    };
    rateLimitMetaCache.set(req, meta);
    if ((v2Data as any).allowed === false) {
      throw new RateLimitError(meta);
    }
    return meta;
  }

  // Fallback v1 — preserva comportamento antigo se v2 indisponível
  const { data: allowed } = await supabase.rpc("check_and_increment_rate_limit", {
    p_chave: key,
    p_limite: limit,
  });
  if (allowed === false) {
    throw new RateLimitError();
  }
  return undefined;
}

export class RateLimitError extends Error {
  status = 429;
  retryAfter = 60;
  metadata?: RateLimitMetadata;
  constructor(metadata?: RateLimitMetadata) {
    super("Rate limit excedido. Tente novamente em 60 segundos.");
    this.name = "RateLimitError";
    this.metadata = metadata;
  }
}
