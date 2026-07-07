// Recebe lote autoritativo de Faturamento (agregado empresa x mês) e faz upsert no staging.
// Auth: Bearer RUBYSP_SYNC_TOKEN ou FUTURA_SYNC_TOKEN.
// Contrato: POST { tipo, faturamento: [{empresa_id, ano_mes, faturamento_liquido, vendas_brutas, devolucoes, n_notas}], snapshot_fim }
// Quando snapshot_fim === true, dispara fn_transform_faturamento_rubysp após o upsert.
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const LinhaSchema = z.object({
  empresa_id: z.number().int(),
  ano_mes: z.string().regex(/^\d{4}-\d{2}$/),
  faturamento_liquido: z.number().optional().nullable(),
  vendas_brutas: z.number().optional().nullable(),
  devolucoes: z.number().optional().nullable(),
  n_notas: z.number().int().optional().nullable(),
}).strict();

const BodySchema = z.object({
  tipo: z.string(),
  faturamento: z.array(LinhaSchema).min(0).max(5000).optional().default([]),
  snapshot_fim: z.boolean().optional().default(false),
}).strict();

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 60, rateLimitPrefix: "receber-faturamento-rubysp", skipWaf: true },
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
    const { faturamento, snapshot_fim } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let staged = 0;
    const errors: Array<{ key: string; error: string }> = [];

    try {
      const chunkSize = 500;
      for (let i = 0; i < faturamento.length; i += chunkSize) {
        const chunk = faturamento.slice(i, i + chunkSize);
        const rows = chunk.map((r) => ({
          empresa_id: r.empresa_id,
          ano_mes: r.ano_mes,
          faturamento_liquido: r.faturamento_liquido ?? null,
          vendas_brutas: r.vendas_brutas ?? null,
          devolucoes: r.devolucoes ?? null,
          n_notas: r.n_notas ?? null,
          staged_at: new Date().toISOString(),
        }));
        const { error: upErr } = await supabase
          .from("erp_faturamento_rubysp")
          .upsert(rows, { onConflict: "empresa_id,ano_mes" });
        if (upErr) {
          for (const r of chunk) {
            errors.push({ key: `${r.empresa_id}/${r.ano_mes}`, error: upErr.message });
          }
          continue;
        }
        staged += rows.length;
      }

      let transform: { inseridos: number; atualizados: number } | null = null;

      if (snapshot_fim) {
        const { data: tData, error: tErr } = await supabase.rpc(
          "fn_transform_faturamento_rubysp",
        );
        if (tErr) {
          errors.push({ key: "", error: `transform: ${tErr.message}` });
        } else if (Array.isArray(tData) && tData.length > 0) {
          const row = tData[0] as Record<string, number | string>;
          transform = {
            inseridos: Number(row.inseridos ?? 0),
            atualizados: Number(row.atualizados ?? 0),
          };
        }
      }

      const success = errors.length === 0;
      const afetados = transform ? transform.inseridos + transform.atualizados : 0;
      await supabase.from("sync_log_rubysp").insert({
        origem: "faturamento",
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
        origem: "faturamento",
        pedidos_qtd: staged,
        itens_qtd: 0,
        ok: false,
        detalhe: msg.slice(0, 4000),
      });
      return json(500, { error: "internal_error", details: msg });
    }
  },
));
