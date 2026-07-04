// Recebe lote de centros de custo Ruby_SP e faz upsert no staging.
// Auth: Bearer RUBYSP_SYNC_TOKEN ou FUTURA_SYNC_TOKEN.
// Quando snapshot_fim === true, dispara fn_transform_ccusto_rubysp após o upsert.
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const CCustoSchema = z.object({
  rubysp_ccusto_id: z.number().int(),
  empresa_par: z.number().int().optional().nullable(),
  descricao: z.string().optional().nullable(),
  tipo: z.number().int().optional().nullable(),
  cod_contabil: z.string().optional().nullable(),
  apurar: z.boolean().optional().nullable(),
}).passthrough();

const BodySchema = z.object({
  tipo: z.string(),
  ccustos: z.array(CCustoSchema).min(0).max(5_000),
  snapshot_fim: z.boolean().optional().default(false),
}).strict();

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 60, rateLimitPrefix: "receber-ccusto-rubysp", skipWaf: true },
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
    const { ccustos, snapshot_fim } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date().toISOString();
    let staged = 0;
    const errors: Array<{ rubysp_ccusto_id: number; error: string }> = [];

    try {
      const chunkSize = 500;
      for (let i = 0; i < ccustos.length; i += chunkSize) {
        const chunk = ccustos.slice(i, i + chunkSize);
        const rows = chunk.map((c) => ({
          rubysp_ccusto_id: c.rubysp_ccusto_id,
          empresa_par: c.empresa_par ?? null,
          descricao: c.descricao ?? null,
          tipo: c.tipo ?? null,
          cod_contabil: c.cod_contabil ?? null,
          apurar: c.apurar ?? null,
          raw: c as unknown as Record<string, unknown>,
          sincronizado_em: now,
        }));
        const { error: upErr } = await supabase
          .from("erp_ccusto_rubysp")
          .upsert(rows, { onConflict: "rubysp_ccusto_id" });
        if (upErr) {
          for (const r of chunk) {
            errors.push({ rubysp_ccusto_id: r.rubysp_ccusto_id, error: upErr.message });
          }
          continue;
        }
        staged += rows.length;
      }

      let transform: { inseridos: number; atualizados: number } | null = null;
      if (snapshot_fim) {
        const { data: tData, error: tErr } = await supabase.rpc(
          "fn_transform_ccusto_rubysp",
        );
        if (tErr) {
          errors.push({ rubysp_ccusto_id: 0, error: `transform: ${tErr.message}` });
        } else if (Array.isArray(tData) && tData.length > 0) {
          const row = tData[0] as { inseridos?: number; atualizados?: number };
          transform = {
            inseridos: Number(row.inseridos ?? 0),
            atualizados: Number(row.atualizados ?? 0),
          };
        }
      }

      const success = errors.length === 0;
      const afetados = transform ? transform.inseridos + transform.atualizados : 0;
      await supabase.from("sync_log_rubysp").insert({
        origem: "ccusto",
        pedidos_qtd: staged,
        itens_qtd: afetados,
        ok: success,
        detalhe: success ? null : JSON.stringify(errors).slice(0, 4000),
      });

      return json(success ? 200 : 207, {
        ok: success,
        staged,
        transform,
        ...(success ? {} : { errors }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.from("sync_log_rubysp").insert({
        origem: "ccusto",
        pedidos_qtd: staged,
        itens_qtd: 0,
        ok: false,
        detalhe: msg.slice(0, 4000),
      });
      return json(500, { error: "internal_error", details: msg });
    }
  },
));
