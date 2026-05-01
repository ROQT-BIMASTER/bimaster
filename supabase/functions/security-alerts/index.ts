// security-alerts — gestão de regras + avaliação + listagem (admin only)
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(secureHandler({
  auth: "jwt",
  rateLimit: 60,
  rateLimitPrefix: "security-alerts",
}, async (req, ctx) => {
  const cors = getCorsHeaders(req);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: isAdmin } = await sb.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin only" }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const op = url.searchParams.get("op") ?? "list";

  // ---- READ
  if (req.method === "GET" && op === "list") {
    const [rulesRes, alertsRes] = await Promise.all([
      sb.from("security_alert_rules").select("*").order("severity", { ascending: false }),
      sb.from("security_alerts").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    return new Response(JSON.stringify({
      rules: rulesRes.data ?? [],
      alerts: alertsRes.data ?? [],
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  // ---- EVALUATE NOW
  if (req.method === "POST" && op === "evaluate") {
    const { data, error } = await sb.rpc("security_evaluate_alerts");
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(data), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ---- UPDATE RULE
  if (req.method === "POST" && op === "update_rule") {
    const body = await req.json();
    const id = String(body.id ?? "");
    if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    const patch: Record<string, unknown> = {};
    if (typeof body.threshold === "number") patch.threshold = body.threshold;
    if (typeof body.cooldown_minutes === "number" && body.cooldown_minutes >= 1 && body.cooldown_minutes <= 10080) {
      patch.cooldown_minutes = Math.floor(body.cooldown_minutes);
    }
    if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
    if (typeof body.severity === "string" && ["info","warn","high","critical"].includes(body.severity)) {
      patch.severity = body.severity;
    }
    if (typeof body.comparison === "string" && ["lt","lte","gt","gte","eq"].includes(body.comparison)) {
      patch.comparison = body.comparison;
    }

    if (Object.keys(patch).length === 0) {
      return new Response(JSON.stringify({ error: "no valid fields" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { data, error } = await sb.from("security_alert_rules").update(patch).eq("id", id).select().single();
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    return new Response(JSON.stringify(data), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  // ---- ACK ALERT
  if (req.method === "POST" && op === "acknowledge") {
    const body = await req.json();
    const id = String(body.id ?? "");
    if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    const { data, error } = await sb.from("security_alerts").update({
      acknowledged: true, acknowledged_by: ctx.userId, acknowledged_at: new Date().toISOString(),
    }).eq("id", id).select().single();
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    return new Response(JSON.stringify(data), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "unknown op" }), {
    status: 400, headers: { ...cors, "Content-Type": "application/json" },
  });
}));
