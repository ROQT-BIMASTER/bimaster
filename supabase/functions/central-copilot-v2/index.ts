// central-copilot-v2 — Phase 1 wrapper. Same request/response shape as the legacy
// `central-copilot`, but runs the reply through the v2 Citation (C1) +
// Number (C2) contracts and logs a `copilot_runs` row. Front-end opts in via
// feature flag `ff_copilot_v2_central`.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "https://esm.sh/zod@3.23.8";
import { callLegacyCopilot } from "../_shared/copilot-tools/proxy-legacy.ts";
import { wrapLegacyCopilotReply } from "../_shared/copilot-tools/contract-wrap.ts";

const Body = z.object({
  thread_id: z.string().uuid().optional(),
  user_message: z.string().min(1).max(8000),
}).strict();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startedAtMs = Date.now();
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  let json: unknown;
  try { json = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const userSb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData } = await userSb.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
      status: proxied.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

  return new Response(JSON.stringify(wrapped.payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
