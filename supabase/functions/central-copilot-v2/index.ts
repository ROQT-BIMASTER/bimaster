// central-copilot-v2 — Phase 1 wrapper. Same request/response shape as the legacy
// `central-copilot`, but runs the reply through the v2 Citation (C1) +
// Number (C2) contracts and logs a `copilot_runs` row. Front-end opts in via
// feature flag `ff_copilot_v2_central`.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callLegacyCopilot } from "../_shared/copilot-tools/proxy-legacy.ts";
import { wrapLegacyCopilotReply } from "../_shared/copilot-tools/contract-wrap.ts";
import { enqueueCopilotDoc } from "../_shared/copilot-tools/enqueue-doc.ts";

const Body = z.object({
  thread_id: z.string().uuid().optional(),
  user_message: z.string().min(1).max(8000),
}).passthrough();

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 30, rateLimitPrefix: "central-copilot-v2" },
  async (req, ctx) => {
    const cors = getCorsHeaders(req);
    const startedAtMs = Date.now();
    const authHeader = req.headers.get("Authorization") ?? "";
    const userId = ctx.userId!;

    let json: unknown;
    try { json = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const proxied = await callLegacyCopilot<{
      reply?: string;
      sources?: Array<Record<string, unknown>>;
      [k: string]: unknown;
    }>({
      legacyName: "central-copilot",
      authHeader,
      body: parsed.data,
      timeoutMs: 90_000,
    });
    if (!proxied.ok) {
      return new Response(JSON.stringify({ error: proxied.error }), {
        status: proxied.status, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const wrapped = await wrapLegacyCopilotReply({
      copilotId: "central",
      userId,
      requestId: crypto.randomUUID(),
      legacy: {
        reply: String(proxied.data.reply ?? ""),
        sources: (proxied.data.sources ?? []) as Array<Record<string, unknown>>,
        ...proxied.data,
      },
      supabase: sb,
      startedAtMs,
      model: typeof proxied.data.model === "string" ? proxied.data.model : undefined,
    });

    await enqueueCopilotDoc(sb, {
      copilotId: "central",
      sourceType: "copilot_thread",
      sourceRef: String(parsed.data.thread_id ?? wrapped.runId),
      title: `central · ${parsed.data.user_message.slice(0, 80)}`,
      content: `Q: ${parsed.data.user_message}\n\nA: ${String(proxied.data.reply ?? "")}`,
      aclScope: { owner: userId },
      metadata: { run_id: wrapped.runId, sources_count: (proxied.data.sources ?? []).length },
      createdBy: userId,
    });
    return new Response(JSON.stringify(wrapped.payload), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
));
