// Wrapper acionado pelo pg_cron a cada 5h.
// Faz a ponte entre o pg_cron (que não tem acesso direto aos secrets)
// e o erp-sync-engine (que exige Bearer service-role ou x-cron-secret).
//
// Segurança: idempotente, rate-limited (30/min) e operação read-only do ponto
// de vista do ERP. Worst-case abuse = sync extra (sem efeito colateral).

import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 6, rateLimitPrefix: "cron-estoque-trigger" },
  async (req) => {
    const cors = getCorsHeaders(req);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

    const startedAt = new Date().toISOString();
    const results: Array<{ step: string; status: number; ok: boolean; body?: unknown }> = [];

    // 1) Dispara o sync completo de estoque (todas as empresas).
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/erp-sync-engine`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_ROLE}`,
          ...(CRON_SECRET ? { "x-cron-secret": CRON_SECRET } : {}),
        },
        body: JSON.stringify({ path: "sync-estoque-full" }),
      });
      let body: unknown = null;
      try { body = await r.json(); } catch { body = await r.text(); }
      results.push({ step: "sync-estoque-full", status: r.status, ok: r.ok, body });
    } catch (e) {
      results.push({
        step: "sync-estoque-full",
        status: 0,
        ok: false,
        body: { error: e instanceof Error ? e.message : String(e) },
      });
    }

    return new Response(
      JSON.stringify({ ok: results.every((r) => r.ok), started_at: startedAt, results }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  },
));
