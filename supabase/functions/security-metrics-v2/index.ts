// security-metrics-v2 — Dashboard metrics consolidado (admin only)
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(secureHandler({
  auth: "jwt",
  rateLimit: 60,
  rateLimitPrefix: "security-metrics-v2",
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
  const op = url.searchParams.get("op") ?? "metrics";

  if (op === "metrics") {
    const { data, error } = await sb.rpc("security_v2_metrics");
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    return new Response(JSON.stringify(data), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  if (op === "anomalies") {
    const { data } = await sb.from("anomaly_events").select("*").order("created_at", { ascending: false }).limit(100);
    return new Response(JSON.stringify(data ?? []), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  if (op === "secrets") {
    const { data } = await sb.from("secret_rotation_policy").select("*").order("is_critical", { ascending: false });
    return new Response(JSON.stringify(data ?? []), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  if (op === "pentest_runs") {
    const { data } = await sb.from("pentest_runs").select("*").order("started_at", { ascending: false }).limit(20);
    return new Response(JSON.stringify(data ?? []), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  if (op === "pentest_findings") {
    const runId = url.searchParams.get("run_id");
    if (!runId) return new Response(JSON.stringify({ error: "run_id required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    const { data } = await sb.from("pentest_findings").select("*").eq("run_id", runId).order("severity", { ascending: false });
    return new Response(JSON.stringify(data ?? []), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  if (op === "dependencies") {
    const { data } = await sb.from("dependency_findings").select("*").eq("status", "open").order("severity", { ascending: false }).limit(100);
    return new Response(JSON.stringify(data ?? []), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "unknown op" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
}));
