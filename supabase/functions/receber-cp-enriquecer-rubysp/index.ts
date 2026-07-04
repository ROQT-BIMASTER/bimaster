// Recebe lote de enriquecimento de Contas a Pagar (Ruby_SP dbo.ContasPagar) e faz upsert no staging.
// Auth: Bearer RUBYSP_SYNC_TOKEN ou FUTURA_SYNC_TOKEN.
// Contrato: POST { tipo, snapshot_fim, titulos: [{erp_id, status_tpg, custo_tpg, historico_tpg}] }
// Quando snapshot_fim === true, dispara fn_enriquecer_contas_pagar_rubysp após o upsert.
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const TituloSchema = z.object({
  erp_id: z.string().min(1),
  status_tpg: z.number().int().optional().nullable(),
  custo_tpg: z.number().int().optional().nullable(),
  historico_tpg: z.number().int().optional().nullable(),
}).passthrough();

const BodySchema = z.object({
  tipo: z.string(),
  titulos: z.array(TituloSchema).min(0).max(5_000),
  snapshot_fim: z.boolean().optional().default(false),
}).strict();

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 60, rateLimitPrefix: "receber-cp-enriquecer-rubysp", skipWaf: true },
  async (req) => {
    const cors = getCorsHeaders(req);
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

    const tokRubysp = Deno.env.get("RUBYSP_SYNC_TOKEN") ?? "";
    const tokFutura = Deno.env.get("FUTURA_SYNC_TOKEN") ?? "";
    if (!tokRubysp && !tokFutura) return json(500, { error: "server_misconfigured" });

    const authHeader = req.headers.get("Authorization") ?? "";
    const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const ok =
      (!!tokRubysp && constantTimeEquals(provided, tokRubysp)) ||
      (!!tokFutura && constantTimeEquals(provided, tokFutura));
    if (!provided || !ok) return json(401, { error: "unauthorized" });

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
    const { titulos, snapshot_fim } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date().toISOString();
    let staged = 0;
    const errors: Array<{ erp_id: string; error: string }> = [];

    try {
      const chunkSize = 500;
      for (let i = 0; i < titulos.length; i += chunkSize) {
        const chunk = titulos.slice(i, i + chunkSize);
        const rows = chunk.map((t) => ({
          erp_id: t.erp_id,
          status_tpg: t.status_tpg ?? null,
          custo_tpg: t.custo_tpg ?? null,
          historico_tpg: t.historico_tpg ?? null,
          sincronizado_em: now,
        }));
        const { error: upErr } = await supabase
          .from("erp_cp_enriq_rubysp")
          .upsert(rows, { onConflict: "erp_id" });
        if (upErr) {
          for (const r of chunk) {
            errors.push({ erp_id: r.erp_id, error: upErr.message });
          }
          continue;
        }
        staged += rows.length;
      }

      let enrich: {
        titulos_casados: number;
        provisionados_total: number;
        com_centro: number;
        com_plano: number;
      } | null = null;

      if (snapshot_fim) {
        const { data: eData, error: eErr } = await supabase.rpc(
          "fn_enriquecer_contas_pagar_rubysp",
        );
        if (eErr) {
          errors.push({ erp_id: "", error: `enriquecer: ${eErr.message}` });
        } else if (Array.isArray(eData) && eData.length > 0) {
          const row = eData[0] as Record<string, number | string>;
          enrich = {
            titulos_casados: Number(row.titulos_casados ?? 0),
            provisionados_total: Number(row.provisionados_total ?? 0),
            com_centro: Number(row.com_centro ?? 0),
            com_plano: Number(row.com_plano ?? 0),
          };
        }
      }

      const success = errors.length === 0;
      const casados = enrich ? enrich.titulos_casados : 0;
      await supabase.from("sync_log_rubysp").insert({
        origem: "cp_enriquecer",
        pedidos_qtd: staged,
        itens_qtd: casados,
        ok: success,
        detalhe: success ? null : JSON.stringify(errors).slice(0, 4000),
      });

      return json(success ? 200 : 207, {
        ok: success,
        staged,
        enrich,
        ...(success ? {} : { errors }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.from("sync_log_rubysp").insert({
        origem: "cp_enriquecer",
        pedidos_qtd: staged,
        itens_qtd: 0,
        ok: false,
        detalhe: msg.slice(0, 4000),
      });
      return json(500, { error: "internal_error", details: msg });
    }
  },
));
