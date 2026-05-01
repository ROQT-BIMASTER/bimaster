// siem-correlate — Correlates security_events to detect attacks (cron-friendly).
// Runs sliding-window aggregations defined in `siem_correlation_rules`.
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 10, rateLimitPrefix: "siem-correlate" },
  async (_req, ctx) => {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    // Only admins can trigger
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const { data: rules } = await sb.from("siem_correlation_rules")
      .select("*").eq("enabled", true);

    const alerts: any[] = [];
    for (const rule of rules ?? []) {
      const since = new Date(Date.now() - rule.window_seconds * 1000).toISOString();
      if (rule.rule_key === "credential_stuffing") {
        const { data } = await sb.from("security_events")
          .select("ip, user_id")
          .in("event_type", ["auth.failure", "mfa.verify_fail"])
          .gte("created_at", since);
        const byIp = new Map<string, number>();
        for (const r of data ?? []) {
          if (!r.ip) continue;
          byIp.set(r.ip, (byIp.get(r.ip) ?? 0) + 1);
        }
        for (const [ip, count] of byIp) {
          if (count >= rule.threshold) {
            alerts.push({ rule_key: rule.rule_key, ip, severity: rule.severity, matched_count: count, payload: { window_s: rule.window_seconds } });
          }
        }
      } else if (rule.rule_key === "mass_export") {
        const { data } = await sb.from("security_events")
          .select("user_id")
          .eq("event_type", "data.export")
          .gte("created_at", since);
        const byUser = new Map<string, number>();
        for (const r of data ?? []) {
          if (!r.user_id) continue;
          byUser.set(r.user_id, (byUser.get(r.user_id) ?? 0) + 1);
        }
        for (const [uid, count] of byUser) {
          if (count >= rule.threshold) {
            alerts.push({ rule_key: rule.rule_key, user_id: uid, severity: rule.severity, matched_count: count });
          }
        }
      } else if (rule.rule_key === "privilege_escalation") {
        const { data } = await sb.from("security_events")
          .select("user_id, ip")
          .eq("event_type", "role.change_no_stepup")
          .gte("created_at", since);
        for (const r of data ?? []) {
          alerts.push({ rule_key: rule.rule_key, user_id: r.user_id, ip: r.ip, severity: rule.severity });
        }
      }
    }

    if (alerts.length > 0) {
      await sb.from("siem_alerts").insert(alerts);
    }
    return json({ generated: alerts.length });
  },
));

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json" },
  });
}
