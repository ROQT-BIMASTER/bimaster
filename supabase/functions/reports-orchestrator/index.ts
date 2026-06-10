// reports-orchestrator: run_report(preview|publish) → linter → metric snapshot
// → optional narrative → synchronous alert evaluation.
// See RFC v4.0.0 §C7, §C9.

import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  lintReportLayout,
  canPublish,
} from "../_shared/copilot-tools/reports/linter.ts";

const Body = z
  .object({
    reportId: z.string().min(1).max(120),
    mode: z.enum(["preview", "publish"]),
    triggerSource: z.enum(["manual", "schedule", "event"]).default("manual"),
    period: z
      .object({ start: z.string().datetime(), end: z.string().datetime() })
      .optional(),
  })
  .strict();

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 30, rateLimitPrefix: "reports-orchestrator" },
    async (req, ctx) => {
      const cors = getCorsHeaders(req);
      const startedAt = Date.now();

      const parsed = Body.safeParse(await req.json());
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const { reportId, mode, triggerSource, period } = parsed.data;

      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const { data: def, error: dErr } = await sb
        .from("report_definitions")
        .select("*")
        .eq("report_id", reportId)
        .maybeSingle();
      if (dErr || !def) {
        return new Response(JSON.stringify({ error: "report_not_found" }), {
          status: 404,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Lint blocks publish on any ERROR.
      const findings = lintReportLayout(def);
      if (mode === "publish" && !canPublish(findings)) {
        return new Response(
          JSON.stringify({ error: "lint_blocked", findings }),
          { status: 422, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      // Compute metric snapshot — read last metric_run per referenced metric.
      const metricRefs = Array.isArray(def.metric_refs) ? def.metric_refs : [];
      const metricIds = metricRefs.map((r: any) => r.metricId).filter(Boolean);
      let metricSnapshot: Record<string, unknown> = {};
      if (metricIds.length > 0) {
        const { data: runs } = await sb
          .from("metric_runs")
          .select("metric_id, value, period_start, period_end, computed_at")
          .in("metric_id", metricIds)
          .order("computed_at", { ascending: false })
          .limit(metricIds.length * 2);
        for (const r of runs ?? []) {
          if (!(r.metric_id in metricSnapshot)) {
            (metricSnapshot as any)[r.metric_id] = r;
          }
        }
      }

      // Insert report_runs.
      const { data: run, error: rErr } = await sb
        .from("report_runs")
        .insert({
          report_id: reportId,
          mode,
          triggered_by: ctx?.userId ?? null,
          trigger_source: triggerSource,
          period_start: period?.start ?? null,
          period_end: period?.end ?? null,
          status: "succeeded",
          metric_snapshot: metricSnapshot,
          latency_ms: Date.now() - startedAt,
        })
        .select("id")
        .maybeSingle();
      if (rErr || !run) {
        return new Response(JSON.stringify({ error: rErr?.message ?? "run_insert_failed" }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Synchronous alert evaluation (best-effort; cron evaluator does retries).
      try {
        await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/reports-alerts-evaluator`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ runId: run.id }),
          },
        );
      } catch {
        // Cron fallback will pick it up.
      }

      return new Response(
        JSON.stringify({ runId: run.id, mode, findings, metricSnapshot }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    },
  ),
);
