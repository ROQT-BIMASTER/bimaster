// Recebe lotes de histórico mensal (faturamento por cliente) do conector Ruby_SP.
// Auth: Bearer RUBYSP_SYNC_TOKEN.
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const LinhaSchema = z.object({
  cliente_id: z.number().int(),
  ano_mes: z.string().regex(/^\d{4}-\d{2}$/),
  faturamento: z.number().optional().nullable(),
  quantidade: z.number().optional().nullable(),
  n_pedidos: z.number().int().optional().nullable(),
}).passthrough();

const BodySchema = z.object({
  tipo: z.literal("historico_mensal"),
  periodo_de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  periodo_ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  linhas: z.array(LinhaSchema).min(0).max(5_000),
}).strict();

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 60, rateLimitPrefix: "receber-historico-rubysp", skipWaf: true },
  async (req) => {
    const cors = getCorsHeaders(req);
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

    const expected = Deno.env.get("RUBYSP_SYNC_TOKEN");
    if (!expected) return json(500, { error: "server_misconfigured" });

    const authHeader = req.headers.get("Authorization") ?? "";
    const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!provided || !constantTimeEquals(provided, expected)) {
      return json(401, { error: "unauthorized" });
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return json(400, { error: "invalid_json" });
    }
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return json(400, { error: "validation_error", details: parsed.error.flatten() });
    }
    const { periodo_de, periodo_ate, linhas } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date().toISOString();
    let upserted = 0;

    try {
      const rows = linhas.map((l) => ({
        cliente_id: l.cliente_id,
        ano_mes: l.ano_mes,
        faturamento: l.faturamento ?? 0,
        quantidade: l.quantidade ?? 0,
        n_pedidos: l.n_pedidos ?? 0,
        sincronizado_em: now,
      }));

      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const { error } = await supabase
          .from("erp_cliente_compras_mensal_rubysp")
          .upsert(slice, { onConflict: "cliente_id,ano_mes" });
        if (error) throw error;
        upserted += slice.length;
      }

      await supabase.from("sync_log_rubysp").insert({
        origem: "historico",
        periodo_de: periodo_de ?? null,
        periodo_ate: periodo_ate ?? null,
        pedidos_qtd: linhas.length,
        itens_qtd: null,
        ok: true,
        detalhe: null,
      });

      return json(200, { ok: true, linhas_upserted: upserted });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.from("sync_log_rubysp").insert({
        origem: "historico",
        periodo_de: periodo_de ?? null,
        periodo_ate: periodo_ate ?? null,
        pedidos_qtd: linhas.length,
        itens_qtd: null,
        ok: false,
        detalhe: msg.slice(0, 4000),
      });
      return json(500, { error: "internal_error", details: msg });
    }
  },
));
