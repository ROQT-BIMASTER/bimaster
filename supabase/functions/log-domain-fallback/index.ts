// log-domain-fallback — registra eventos de fallback automático de domínio.
// Endpoint público (sem JWT) com rate-limit por IP. Insere via service-role.
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const Body = z.object({
  reason: z.string().min(1).max(80),
  elapsed_ms: z.number().int().min(0).max(600_000).optional(),
  origin_host: z.string().max(253).optional(),
  target_host: z.string().max(253).optional(),
  pathname: z.string().max(2048).optional(),
  user_id: z.string().uuid().optional(),
}).strict();

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 60, rateLimitPrefix: "log-domain-fallback" },
  async (req) => {
    const cors = getCorsHeaders(req);
    let payload: unknown;
    try { payload = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const parsed = Body.safeParse(payload);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const ua = req.headers.get("user-agent")?.slice(0, 500) ?? null;

    const { error } = await sb.from("domain_fallback_logs").insert({
      reason: parsed.data.reason,
      elapsed_ms: parsed.data.elapsed_ms ?? null,
      origin_host: parsed.data.origin_host ?? null,
      target_host: parsed.data.target_host ?? null,
      pathname: parsed.data.pathname ?? null,
      user_agent: ua,
      user_id: parsed.data.user_id ?? null,
    });
    if (error) {
      return new Response(JSON.stringify({ error: "insert_failed" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
));
