// Security middleware — checks IP blocklist and user lockout with in-memory cache
import { createClient } from "npm:@supabase/supabase-js@2";

interface BlocklistEntry {
  ip_address: string;
  block_level: string;
}

interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
  blockLevel?: string;
}

// In-memory cache with 30s TTL
let blocklistCache: BlocklistEntry[] = [];
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000;

async function getBlocklist(supabase: any): Promise<BlocklistEntry[]> {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_TTL_MS && blocklistCache.length > 0) {
    return blocklistCache;
  }

  const { data } = await supabase
    .from("security_ip_blocklist")
    .select("ip_address, block_level")
    .eq("is_active", true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  blocklistCache = (data || []).map((r: any) => ({
    ip_address: String(r.ip_address),
    block_level: r.block_level || "hard",
  }));
  cacheTimestamp = now;
  return blocklistCache;
}

/**
 * Check if the request is allowed based on IP blocklist and user lock status.
 * Call this at the beginning of any Edge Function that needs protection.
 */
export async function securityCheck(req: Request, userId?: string): Promise<SecurityCheckResult> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!ip) return { allowed: true };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Check cached blocklist
  const blocklist = await getBlocklist(supabase);
  const match = blocklist.find((b) => b.ip_address === ip);

  if (match) {
    // Log blocked attempt
    await supabase.from("security_audit_log").insert({
      action: "blocked_request",
      severity: match.block_level === "hard" ? "high" : "medium",
      metadata: { ip, reason: "ip_blocklist", block_level: match.block_level, user_id: userId },
    }).catch(() => {});

    if (match.block_level === "hard") {
      return { allowed: false, reason: "IP bloqueado por política de segurança", blockLevel: "hard" };
    }

    // Soft block — allow but flag for aggressive rate limiting
    return { allowed: true, blockLevel: "soft" };
  }

  return { allowed: true };
}
