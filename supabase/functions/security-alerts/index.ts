import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(
  secureHandler(
    // Endpoint chamado por scheduler/cron com service role — exige API key.
    { auth: "apikey", rateLimit: 60, rateLimitPrefix: "security-alerts" },
    async (req) => {
      const cors = getCorsHeaders(req);
      const headers = { ...cors, "Content-Type": "application/json" };

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const now = new Date();
      const last1h = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

      const { data: criticalEvents, error } = await supabase
        .from("security_audit_log")
        .select("id, action, severity, created_at, metadata")
        .eq("severity", "critical")
        .gte("created_at", last1h);

      if (error) throw error;

      if (!criticalEvents || criticalEvents.length === 0) {
        return new Response(
          JSON.stringify({ message: "No critical events", alerts_sent: 0 }),
          { headers }
        );
      }

      const { count: failedLogins } = await supabase
        .from("access_audit_log")
        .select("*", { count: "exact", head: true })
        .eq("action", "login_failed")
        .gte("created_at", last1h);

      const alerts: string[] = [];

      if (criticalEvents.length > 0) {
        alerts.push(`${criticalEvents.length} evento(s) crítico(s) na última hora`);
      }

      if ((failedLogins ?? 0) >= 10) {
        alerts.push(
          `${failedLogins} tentativas de login falhadas na última hora (possível brute force)`
        );
      }

      await supabase.from("security_audit_log").insert({
        action: "security_alert_check",
        severity: alerts.length > 0 ? "high" : "low",
        metadata: {
          alerts_generated: alerts.length,
          critical_events: criticalEvents.length,
          failed_logins: failedLogins ?? 0,
          details: alerts,
        },
      });

      return new Response(
        JSON.stringify({
          message: alerts.length > 0 ? "Alerts detected" : "All clear",
          alerts,
          alerts_sent: alerts.length,
        }),
        { headers }
      );
    }
  )
);
