// reports-alerts-evaluator: evaluate alert_rules for a given runId.
// Synchronous post-run path (called by orchestrator) and cron fallback.

import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const Body = z.object({ runId: z.string().uuid().optional() }).strict();

Deno.serve(
  secureHandler(
    { auth: "any", rateLimit: 60, rateLimitPrefix: "reports-alerts-evaluator" },
    async (req, ctx) => {
      const cors = getCorsHeaders(req);
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      // Only service-role (api_key) callers or admins may trigger evaluation.
      const isApiKey = (ctx as any)?.authSource === "api_key";
      const callerId: string | null = (ctx as any)?.userId ?? null;
      if (!isApiKey) {
        if (!callerId) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        const { data: adminRole } = await sb
          .from("user_roles")
          .select("role")
          .eq("user_id", callerId)
          .eq("role", "admin")
          .maybeSingle();
        if (!adminRole) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
      }

      const parsed = Body.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }


      let runs: Array<{ id: string; report_id: string; metric_snapshot: any }> = [];
      if (parsed.data.runId) {
        const { data } = await sb
          .from("report_runs")
          .select("id, report_id, metric_snapshot")
          .eq("id", parsed.data.runId)
          .maybeSingle();
        if (data) runs = [data as any];
      } else {
        const { data } = await sb
          .from("report_runs")
          .select("id, report_id, metric_snapshot")
          .is("alerts_evaluated_at", null)
          .order("created_at", { ascending: true })
          .limit(50);
        runs = (data as any[]) ?? [];
      }

      const events: any[] = [];
      for (const r of runs) {
        const { data: rules } = await sb
          .from("alert_rules")
          .select("*")
          .or(`report_id.eq.${r.report_id},report_id.is.null`)
          .eq("enabled", true);
        for (const rule of rules ?? []) {
          const fired = evaluateRule(rule, r.metric_snapshot);
          if (!fired.fired) continue;
          await sb.from("alert_events").insert({
            rule_id: rule.id,
            run_id: r.id,
            metric_id: rule.metric_id,
            variation: fired.variation ?? null,
            payload: fired.payload ?? {},
          });
          events.push({ ruleId: rule.id, runId: r.id });
        }
        await sb.from("report_runs").update({ alerts_evaluated_at: new Date().toISOString() }).eq("id", r.id);
      }

      return new Response(JSON.stringify({ evaluatedRuns: runs.length, events }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    },
  ),
);

function evaluateRule(
  rule: any,
  snapshot: Record<string, any>,
): { fired: boolean; variation?: number; payload?: any } {
  const metric = rule.metric_id && snapshot?.[rule.metric_id];
  if (!metric) return { fired: false };
  const value = Number(metric.value ?? metric);
  const params = rule.params ?? {};

  switch (rule.rule_type) {
    case "threshold_breach": {
      const op = params.op ?? "gt";
      const thr = Number(params.threshold);
      const fired = op === "gt" ? value > thr : value < thr;
      return { fired, payload: { value, threshold: thr, op } };
    }
    case "pct_change_gt": {
      const prev = Number(params.previous ?? metric.previous);
      if (!prev) return { fired: false };
      const variation = ((value - prev) / prev) * 100;
      const fired = Math.abs(variation) > Number(params.thresholdPct ?? 10);
      return { fired, variation, payload: { value, previous: prev } };
    }
    case "trend_shift": {
      const series: number[] = params.previousSeries ?? [];
      if (series.length < 2) return { fired: false };
      const oldSlope = series[series.length - 1] - series[0];
      const newSlope = value - series[series.length - 1];
      const fired = Math.sign(oldSlope) !== Math.sign(newSlope) && Math.sign(newSlope) !== 0;
      return { fired, payload: { value, series } };
    }
    default:
      return { fired: false };
  }
}
