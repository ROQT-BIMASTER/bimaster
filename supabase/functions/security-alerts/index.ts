import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const last1h = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    // Check for critical events in the last hour
    const { data: criticalEvents, error } = await supabase
      .from("security_audit_log")
      .select("*")
      .eq("severity", "critical")
      .gte("created_at", last1h);

    if (error) throw error;

    if (!criticalEvents || criticalEvents.length === 0) {
      return new Response(
        JSON.stringify({ message: "No critical events", alerts_sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for concentrated failed logins (brute force indicator)
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
      alerts.push(`${failedLogins} tentativas de login falhadas na última hora (possível brute force)`);
    }

    // Log the alert check
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
