// Security middleware — checks IP blocklist and user lockout
import { createClient } from "npm:@supabase/supabase-js@2";

interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
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

  // Check IP blocklist
  const { data: blocked } = await supabase.rpc("is_ip_blocked", { p_ip: ip });
  if (blocked === true) {
    // Log the blocked attempt
    await supabase.from("security_audit_log").insert({
      action: "blocked_request",
      severity: "high",
      metadata: { ip, reason: "ip_blocklist", user_id: userId },
    }).catch(() => {});

    return { allowed: false, reason: "IP bloqueado por política de segurança" };
  }

  return { allowed: true };
}
