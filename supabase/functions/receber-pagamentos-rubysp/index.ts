// Recebe lote autoritativo de Pagamentos (Ruby_SP dbo.MovimentoConta) e faz upsert no staging.
// Auth: Bearer RUBYSP_SYNC_TOKEN ou FUTURA_SYNC_TOKEN.
// Contrato: POST { tipo, snapshot_fim, movimentos: [{erp_id, empresa_id, conta_id, conta_nome,
//   data_movimento, valor, tipo_mov, ccusto_id, ccusto_nome, historico_id, historico_nome,
//   complemento, documento, forma, pedido}] }
// Quando snapshot_fim === true, dispara fn_transform_pagamentos_rubysp após o upsert.
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const MovimentoSchema = z.object({
  erp_id: z.string().min(1),
  empresa_id: z.number().int().optional().nullable(),
  conta_id: z.string().optional().nullable(),
  conta_nome: z.string().optional().nullable(),
  data_movimento: z.string().optional().nullable(),
  valor: z.number().optional().nullable(),
  tipo_mov: z.enum(["saida", "entrada"]).optional().nullable(),
  ccusto_id: z.number().int().optional().nullable(),
  ccusto_nome: z.string().optional().nullable(),
  historico_id: z.number().int().optional().nullable(),
  historico_nome: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  documento: z.string().optional().nullable(),
  forma: z.number().int().optional().nullable(),
  pedido: z.string().optional().nullable(),
}).passthrough();

const BodySchema = z.object({
  tipo: z.string(),
  movimentos: z.array(MovimentoSchema).min(0).max(5_000),
  snapshot_fim: z.boolean().optional().default(false),
}).strict();

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 60, rateLimitPrefix: "receber-pagamentos-rubysp", skipWaf: true },
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
    const { movimentos, snapshot_fim } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let staged = 0;
    const errors: Array<{ erp_id: string; error: string }> = [];

    try {
      const chunkSize = 500;
      for (let i = 0; i < movimentos.length; i += chunkSize) {
        const chunk = movimentos.slice(i, i + chunkSize);
        const rows = chunk.map((m) => ({
          erp_id: m.erp_id,
          empresa_id: m.empresa_id ?? null,
          conta_id: m.conta_id ?? null,
          conta_nome: m.conta_nome ?? null,
          data_movimento: m.data_movimento ?? null,
          valor: m.valor ?? null,
          tipo_mov: m.tipo_mov ?? null,
          ccusto_id: m.ccusto_id ?? null,
          ccusto_nome: m.ccusto_nome ?? null,
          historico_id: m.historico_id ?? null,
          historico_nome: m.historico_nome ?? null,
          complemento: m.complemento ?? null,
          documento: m.documento ?? null,
          forma: m.forma ?? null,
          pedido: m.pedido ?? null,
          raw: m,
        }));
        const { error: upErr } = await supabase
          .from("erp_pagamentos_rubysp")
          .upsert(rows, { onConflict: "erp_id" });
        if (upErr) {
          for (const r of chunk) {
            errors.push({ erp_id: r.erp_id, error: upErr.message });
          }
          continue;
        }
        staged += rows.length;
      }

      let transform: {
        inseridos: number;
        atualizados: number;
        com_centro: number;
        com_plano: number;
      } | null = null;

      if (snapshot_fim) {
        const { data: tData, error: tErr } = await supabase.rpc(
          "fn_transform_pagamentos_rubysp",
        );
        if (tErr) {
          errors.push({ erp_id: "", error: `transform: ${tErr.message}` });
        } else if (Array.isArray(tData) && tData.length > 0) {
          const row = tData[0] as Record<string, number | string>;
          transform = {
            inseridos: Number(row.inseridos ?? 0),
            atualizados: Number(row.atualizados ?? 0),
            com_centro: Number(row.com_centro ?? 0),
            com_plano: Number(row.com_plano ?? 0),
          };
        }
      }

      const success = errors.length === 0;
      const afetados = transform ? transform.inseridos + transform.atualizados : 0;
      await supabase.from("sync_log_rubysp").insert({
        origem: "pagamentos",
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
        origem: "pagamentos",
        pedidos_qtd: staged,
        itens_qtd: 0,
        ok: false,
        detalhe: msg.slice(0, 4000),
      });
      return json(500, { error: "internal_error", details: msg });
    }
  },
));
