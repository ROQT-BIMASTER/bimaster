// reports-orchestrator: handles run/upsert/publish of report definitions.
// Actions:
//   - run_report       : execute (preview|publish), snapshot metrics, async alerts
//   - upsert_report_definition : create/update draft (linter informational)
//   - publish_report_definition: same as upsert + status='published'; linter blocks
//
// See RFC v4.0.0 §C7, §C9.

import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  lintReportLayout,
  canPublish,
} from "../_shared/copilot-tools/reports/linter.ts";

const RunBody = z
  .object({
    action: z.literal("run_report").optional(),
    reportId: z.string().min(1).max(120),
    mode: z.enum(["preview", "publish"]),
    triggerSource: z.enum(["manual", "schedule", "event"]).default("manual"),
    period: z
      .object({ start: z.string().datetime(), end: z.string().datetime() })
      .optional(),
  })
  .strict();

const ReportShape = z
  .object({
    report_id: z.string().min(1).max(120),
    title: z.string().min(1).max(240),
    question: z.string().min(1).max(2000),
    audience: z.string().min(1).max(80),
    frequency: z.string().min(1).max(40),
    expected_action: z.string().min(1).max(400),
    language: z.string().min(2).max(8).default("pt"),
    layout_spec: z.record(z.string(), z.unknown()).default({}),
    metric_refs: z.array(z.record(z.string(), z.unknown())).default([]),
    scope: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

const UpsertBody = z
  .object({
    action: z.enum(["upsert_report_definition", "publish_report_definition"]),
    report: ReportShape,
  })
  .strict();

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 30, rateLimitPrefix: "reports-orchestrator" },
    async (req, ctx) => {
      const cors = getCorsHeaders(req);
      const startedAt = Date.now();

      const raw = await req.json().catch(() => ({}));
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      // ── Upsert / Publish definition ─────────────────────────────────────
      if (raw?.action === "upsert_report_definition" || raw?.action === "publish_report_definition") {
        const parsed = UpsertBody.safeParse(raw);
        if (!parsed.success) {
          return json({ error: parsed.error.flatten() }, 400, cors);
        }
        const { action, report } = parsed.data;
        const findings = lintReportLayout(report as any);

        if (action === "publish_report_definition" && !canPublish(findings)) {
          return json({ error: "lint_blocked", findings }, 422, cors);
        }

        const row = {
          report_id: report.report_id,
          title: report.title,
          question: report.question,
          audience: report.audience,
          frequency: report.frequency,
          expected_action: report.expected_action,
          language: report.language,
          layout_spec: report.layout_spec,
          metric_refs: report.metric_refs,
          scope: report.scope,
          status: action === "publish_report_definition" ? "published" : "draft",
          owner_user_id: ctx?.userId ?? null,
          updated_at: new Date().toISOString(),
        };

        const { error } = await sb
          .from("report_definitions")
          .upsert(row, { onConflict: "report_id" });
        if (error) return json({ error: error.message }, 500, cors);

        // Audit
        await sb.from("report_audit_log").insert({
          report_id: report.report_id,
          actor_user_id: ctx?.userId ?? null,
          action,
          findings_count: findings.length,
        }).then(() => undefined, () => undefined);

        return json({ ok: true, reportId: report.report_id, status: row.status, findings }, 200, cors);
      }

      // ── Run report ──────────────────────────────────────────────────────
      const parsed = RunBody.safeParse(raw);
      if (!parsed.success) {
        return json({ error: parsed.error.flatten() }, 400, cors);
      }
      const { reportId, mode, triggerSource, period } = parsed.data;

      const { data: def, error: dErr } = await sb
        .from("report_definitions")
        .select("*")
        .eq("report_id", reportId)
        .maybeSingle();
      if (dErr || !def) return json({ error: "report_not_found" }, 404, cors);

      const findings = lintReportLayout(def);
      if (mode === "publish" && !canPublish(findings)) {
        return json({ error: "lint_blocked", findings }, 422, cors);
      }

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
      if (rErr || !run) return json({ error: rErr?.message ?? "run_insert_failed" }, 500, cors);

      // Synchronous alert evaluation (best-effort)
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
        // Cron fallback
      }

      return json({ runId: run.id, mode, findings, metricSnapshot }, 200, cors);
    },
  ),
);

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
