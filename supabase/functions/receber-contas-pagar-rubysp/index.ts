// Recebe lote autoritativo de Contas a Pagar (Ruby_SP dbo.ContasPagar) e faz upsert no staging.
// Auth: Bearer RUBYSP_SYNC_TOKEN ou FUTURA_SYNC_TOKEN.
// Contrato: POST { tipo, snapshot_fim, titulos: [{erp_id, empresa_id, tipo_documento, numero_documento,
//   parcela, fornecedor_codigo, fornecedor_nome, valor_original, valor_aberto, valor_pago,
//   valor_juros, valor_desconto, data_emissao, data_vencimento, data_pagamento,
//   categoria_codigo, categoria_nome, portador, status_tpg, custo_tpg, historico_tpg}] }
// Quando snapshot_fim === true, dispara fn_transform_contas_pagar_rubysp após o upsert.
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const TituloSchema = z.object({
  erp_id: z.string().min(1),
  empresa_id: z.number().int().optional().nullable(),
  tipo_documento: z.string().optional().nullable(),
  numero_documento: z.string().optional().nullable(),
  parcela: z.number().int().optional().nullable(),
  fornecedor_codigo: z.string().optional().nullable(),
  fornecedor_nome: z.string().optional().nullable(),
  valor_original: z.number().optional().nullable(),
  valor_aberto: z.number().optional().nullable(),
  valor_pago: z.number().optional().nullable(),
  valor_juros: z.number().optional().nullable(),
  valor_desconto: z.number().optional().nullable(),
  data_emissao: z.string().optional().nullable(),
  data_vencimento: z.string().optional().nullable(),
  data_pagamento: z.string().optional().nullable(),
  categoria_codigo: z.string().optional().nullable(),
  categoria_nome: z.string().optional().nullable(),
  portador: z.string().optional().nullable(),
  status_tpg: z.number().int().optional().nullable(),
  custo_tpg: z.number().int().optional().nullable(),
  historico_tpg: z.number().int().optional().nullable(),
  setor_tpg: z.number().int().optional().nullable(),
  setor_nome: z.string().optional().nullable(),
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
  { auth: "none", rateLimit: 60, rateLimitPrefix: "receber-contas-pagar-rubysp", skipWaf: true },
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
          empresa_id: t.empresa_id ?? null,
          tipo_documento: t.tipo_documento ?? null,
          numero_documento: t.numero_documento ?? null,
          parcela: t.parcela ?? null,
          fornecedor_codigo: t.fornecedor_codigo ?? null,
          fornecedor_nome: t.fornecedor_nome ?? null,
          valor_original: t.valor_original ?? null,
          valor_aberto: t.valor_aberto ?? null,
          valor_pago: t.valor_pago ?? null,
          valor_juros: t.valor_juros ?? null,
          valor_desconto: t.valor_desconto ?? null,
          data_emissao: t.data_emissao ?? null,
          data_vencimento: t.data_vencimento ?? null,
          data_pagamento: t.data_pagamento ?? null,
          categoria_codigo: t.categoria_codigo ?? null,
          categoria_nome: t.categoria_nome ?? null,
          portador: t.portador ?? null,
          status_tpg: t.status_tpg ?? null,
          custo_tpg: t.custo_tpg ?? null,
          historico_tpg: t.historico_tpg ?? null,
          setor_tpg: t.setor_tpg ?? null,
          setor_nome: t.setor_nome ?? null,
          raw: t,
          sincronizado_em: now,
        }));
        const { error: upErr } = await supabase
          .from("erp_contas_pagar_rubysp")
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
          "fn_transform_contas_pagar_rubysp",
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
        origem: "contas_pagar",
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
        origem: "contas_pagar",
        pedidos_qtd: staged,
        itens_qtd: 0,
        ok: false,
        detalhe: msg.slice(0, 4000),
      });
      return json(500, { error: "internal_error", details: msg });
    }
  },
));
