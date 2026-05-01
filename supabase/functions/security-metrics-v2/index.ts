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

  if (op === "trends") {
    const days = Math.min(parseInt(url.searchParams.get("days") ?? "14", 10), 60);
    const since = new Date(Date.now() - days * 86400_000).toISOString();

    // Parallel reads
    const [wafRes, anomRes, mfaRes, mfaTotalRes] = await Promise.all([
      sb.from("security_audit_log").select("created_at, severity").eq("action", "waf_shadow").gte("created_at", since),
      sb.from("anomaly_events").select("created_at, severity").gte("created_at", since),
      sb.from("mfa_enrollments").select("verified_at").eq("verified", true).not("verified_at", "is", null).gte("verified_at", since),
      sb.rpc("security_v2_metrics"),
    ]);

    // Build day buckets
    const buckets: Record<string, { date: string; waf: number; anom_low: number; anom_med: number; anom_high: number; anom_critical: number; mfa_new: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { date: key, waf: 0, anom_low: 0, anom_med: 0, anom_high: 0, anom_critical: 0, mfa_new: 0 };
    }
    const bucketize = (iso: string) => iso.slice(0, 10);

    for (const r of (wafRes.data ?? []) as any[]) {
      const k = bucketize(r.created_at);
      if (buckets[k]) buckets[k].waf++;
    }
    for (const r of (anomRes.data ?? []) as any[]) {
      const k = bucketize(r.created_at);
      if (!buckets[k]) continue;
      if (r.severity === "critical") buckets[k].anom_critical++;
      else if (r.severity === "high") buckets[k].anom_high++;
      else if (r.severity === "medium") buckets[k].anom_med++;
      else buckets[k].anom_low++;
    }
    for (const r of (mfaRes.data ?? []) as any[]) {
      const k = bucketize(r.verified_at);
      if (buckets[k]) buckets[k].mfa_new++;
    }

    // Cumulative MFA enrollment per day
    const totalRequired = (mfaTotalRes.data as any)?.mfa_required_users ?? 0;
    const totalEnrolled = (mfaTotalRes.data as any)?.mfa_enrolled ?? 0;
    const series = Object.values(buckets);
    let cum = totalEnrolled;
    // walk backwards subtracting new to estimate past totals
    const pastTotals: number[] = [];
    for (let i = series.length - 1; i >= 0; i--) {
      pastTotals.unshift(cum);
      cum -= series[i].mfa_new;
    }
    const enriched = series.map((b, i) => ({
      ...b,
      mfa_total: pastTotals[i],
      mfa_pct: totalRequired > 0 ? Math.round((pastTotals[i] / totalRequired) * 100) : 0,
    }));

    return new Response(JSON.stringify({ series: enriched, mfa_required: totalRequired }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (op === "version_snapshot") {
    // Persist a snapshot of current metrics tagged by version
    const { data } = await sb.rpc("security_v2_metrics");
    return new Response(JSON.stringify({ snapshot: data, captured_at: new Date().toISOString() }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "unknown op" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
}));
