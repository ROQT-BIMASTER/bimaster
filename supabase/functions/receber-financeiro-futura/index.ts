// Recebe o snapshot de posição financeira (contas a receber) por cliente do Sistema Futura.
// Auth: Bearer FUTURA_SYNC_TOKEN (mesmo secret usado por estoque/vendas/pedidos).
// Fluxo:
//   1) POST { tipo: "snapshot", batch_ts, clientes: [...] }  -> upsert em cliente_financeiro
//   2) POST { tipo: "snapshot_fim", batch_ts }               -> deleta clientes com batch_ts != $1
//                                                              (zera quem pagou tudo desde o último ciclo)
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const ClienteSchema = z.object({
  cliente_futura_id: z.number().int().positive(),
  cliente_nome: z.string().optional().nullable(),
  em_aberto: z.number().optional().nullable(),
  vencido: z.number().optional().nullable(),
  a_vencer: z.number().optional().nullable(),
  n_parcelas_abertas: z.number().int().optional().nullable(),
  n_parcelas_vencidas: z.number().int().optional().nullable(),
  n_pedidos_abertos: z.number().int().optional().nullable(),
  n_titulos_abertos: z.number().int().optional().nullable(),
  proximo_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  maior_atraso_dias: z.number().int().optional().nullable(),
}).strict();

const BodySchema = z.object({
  tipo: z.enum(["snapshot", "snapshot_fim"]),
  batch_ts: z.string().min(1),
  clientes: z.array(ClienteSchema).max(10_000).optional().nullable(),
}).strict();

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 60, rateLimitPrefix: "receber-financeiro-futura", skipWaf: true },
  async (req) => {
    const cors = getCorsHeaders(req);
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

    const expected = Deno.env.get("FUTURA_SYNC_TOKEN");
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
    const { tipo, batch_ts, clientes } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    try {
      if (tipo === "snapshot") {
        if (!clientes || clientes.length === 0) {
          return json(400, { error: "clientes_required_for_snapshot" });
        }
        const now = new Date().toISOString();
        const rows = clientes.map((c) => ({
          cliente_futura_id: c.cliente_futura_id,
          cliente_nome: c.cliente_nome ?? null,
          em_aberto: c.em_aberto ?? 0,
          vencido: c.vencido ?? 0,
          a_vencer: c.a_vencer ?? 0,
          n_parcelas_abertas: c.n_parcelas_abertas ?? 0,
          n_parcelas_vencidas: c.n_parcelas_vencidas ?? 0,
          n_pedidos_abertos: c.n_pedidos_abertos ?? 0,
          n_titulos_abertos: c.n_titulos_abertos ?? 0,
          proximo_vencimento: c.proximo_vencimento ?? null,
          maior_atraso_dias: c.maior_atraso_dias ?? 0,
          batch_ts,
          sincronizado_em: now,
        }));

        const CHUNK = 500;
        let upserted = 0;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const slice = rows.slice(i, i + CHUNK);
          const { error, count } = await supabase
            .from("cliente_financeiro")
            .upsert(slice, { onConflict: "cliente_futura_id", count: "exact" });
          if (error) {
            return json(500, {
              error: "upsert_failed",
              details: error.message,
              upserted_before_error: upserted,
            });
          }
          upserted += count ?? slice.length;
        }
        return json(200, { ok: true, upserted });
      }

      // tipo === "snapshot_fim"
      const { error, count } = await supabase
        .from("cliente_financeiro")
        .delete({ count: "exact" })
        .not("batch_ts", "eq", batch_ts);
      // OBS: .not("col","eq",v) traduz para "col <> v" e não remove linhas com
      // batch_ts IS NULL. Tratamos NULL como "linhas antigas" e também removemos:
      if (error) return json(500, { error: "cleanup_failed", details: error.message });

      const { error: err2, count: c2 } = await supabase
        .from("cliente_financeiro")
        .delete({ count: "exact" })
        .is("batch_ts", null);
      if (err2) return json(500, { error: "cleanup_null_failed", details: err2.message });

      return json(200, { ok: true, removed: (count ?? 0) + (c2 ?? 0) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json(500, { error: "internal_error", details: msg });
    }
  },
));
