// _shared/rate-limit.ts — Global rate limiting (SEG-5)
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
 * Check rate limit using existing RPC. Returns true if allowed.
 * Throws RateLimitError if exceeded.
 */
export async function checkRateLimit(opts: RateLimitOptions): Promise<void> {
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

  const { data: allowed } = await supabase.rpc("check_and_increment_rate_limit", {
    p_chave: key,
    p_limite: limit,
  });

  if (allowed === false) {
    throw new RateLimitError();
  }
}

export class RateLimitError extends Error {
  status = 429;
  retryAfter = 60;
  constructor() {
    super("Rate limit excedido. Tente novamente em 60 segundos.");
    this.name = "RateLimitError";
  }
}
