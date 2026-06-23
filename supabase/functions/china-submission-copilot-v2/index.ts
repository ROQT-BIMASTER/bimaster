// china-submission-copilot-v2 — Phase 4 wrapper around `china-submission-copilot`.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callLegacyCopilot } from "../_shared/copilot-tools/proxy-legacy.ts";
import { wrapLegacyCopilotReply } from "../_shared/copilot-tools/contract-wrap.ts";
import { enqueueCopilotDoc } from "../_shared/copilot-tools/enqueue-doc.ts";

const Body = z.object({
  submissao_id: z.string().uuid().optional(),
  thread_id: z.string().uuid().optional(),
  user_message: z.string().min(1).max(8000),
}).passthrough();

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 30, rateLimitPrefix: "china-submission-copilot-v2" },
  async (req, ctx) => {
    const cors = getCorsHeaders(req);
    const startedAtMs = Date.now();
    const authHeader = req.headers.get("Authorization") ?? "";
    const userId = ctx.userId!;

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const proxied = await callLegacyCopilot<{ reply?: string; sources?: any[]; [k: string]: unknown }>({
      legacyName: "china-submission-copilot",
      authHeader,
      body: parsed.data,
      timeoutMs: 120_000,
    });
    if (!proxied.ok) {
      return new Response(JSON.stringify({ error: proxied.error }), {
        status: proxied.status, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const wrapped = await wrapLegacyCopilotReply({
      copilotId: "china",
      userId,
      requestId: crypto.randomUUID(),
      legacy: {
        reply: String(proxied.data.reply ?? ""),
        sources: (proxied.data.sources ?? []) as any[],
        ...proxied.data,
      },
      supabase: sb,
      startedAtMs,
      model: typeof proxied.data.model === "string" ? proxied.data.model : undefined,
    });
    await enqueueCopilotDoc(sb, {
      copilotId: "china",
      sourceType: "copilot_thread",
      sourceRef: String(parsed.data.thread_id ?? wrapped.runId),
      title: `china · ${String(parsed.data.user_message).slice(0, 80)}`,
      content: `Q: ${parsed.data.user_message}\n\nA: ${String(proxied.data.reply ?? "")}`,
      aclScope: { owner: userId, submissao_id: parsed.data.submissao_id ?? null },
      metadata: { run_id: wrapped.runId, submissao_id: parsed.data.submissao_id ?? null },
      createdBy: userId,
    });
    return new Response(JSON.stringify(wrapped.payload), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
));
