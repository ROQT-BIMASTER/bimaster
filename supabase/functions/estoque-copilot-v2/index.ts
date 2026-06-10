// estoque-copilot-v2 — Phase 3 wrapper around `estoque-copilot`.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "https://esm.sh/zod@3.23.8";
import { callLegacyCopilot } from "../_shared/copilot-tools/proxy-legacy.ts";
import { wrapLegacyCopilotReply } from "../_shared/copilot-tools/contract-wrap.ts";

// passthrough — legacy function owns full schema (filtros, kpis_snapshot, ...).
const Body = z.object({
  thread_id: z.string().uuid().optional(),
  user_message: z.string().min(1).max(8000),
}).passthrough();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startedAtMs = Date.now();
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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
  const proxied = await callLegacyCopilot<{ reply?: string; sources?: any[]; [k: string]: unknown }>({
    legacyName: "estoque-copilot",
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
    copilotId: "estoque",
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
  return new Response(JSON.stringify(wrapped.payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
