// Recebe lotes de pedidos Ruby_SP do conector externo e faz upsert no staging.
// Auth: Bearer RUBYSP_SYNC_TOKEN ou FUTURA_SYNC_TOKEN.
// version: itens-v2 (align with table columns)
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const ItemSchema = z.object({
  sequencia: z.number().int(),
  // canônico
  produto_id: z.number().int().optional().nullable(),
  descricao: z.string().optional().nullable(),
  ean: z.string().optional().nullable(),
  unidade: z.string().optional().nullable(),
  quantidade: z.number().optional().nullable(),
  preco: z.number().optional().nullable(),
  desconto: z.number().optional().nullable(),
  total_item: z.number().optional().nullable(),
  // aliases (rede de segurança)
  produto_rubysp_id: z.number().int().optional().nullable(),
  unidade_sigla: z.string().optional().nullable(),
  valor_unitario: z.number().optional().nullable(),
  desconto_valor: z.number().optional().nullable(),
}).passthrough();


const PedidoSchema = z.object({
  rubysp_pedido_id: z.number().int(),
  empresa_id: z.number().int().optional().nullable(),
  data_pedido: z.string().optional().nullable(),
  digitacao_inicio: z.string().optional().nullable(),
  digitacao_fim: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  operacao_id: z.number().int().optional().nullable(),
  operacao_desc: z.string().optional().nullable(),
  bonificacao: z.boolean().optional().nullable(),
  romaneio_id: z.number().int().optional().nullable(),
  pedido_venda_relacionado: z.number().int().optional().nullable(),
  cliente_id: z.number().int().optional().nullable(),
  cliente_nome: z.string().optional().nullable(),
  cliente_cnpj: z.string().optional().nullable(),
  cliente_cidade: z.string().optional().nullable(),
  cliente_uf: z.string().optional().nullable(),
  cond_pagamento_id: z.number().int().optional().nullable(),
  cond_pagamento_desc: z.string().optional().nullable(),
  endereco_logradouro: z.string().optional().nullable(),
  endereco_numero: z.string().optional().nullable(),
  endereco_bairro: z.string().optional().nullable(),
  endereco_cep: z.string().optional().nullable(),
  endereco_entrega: z.string().optional().nullable(),
  vendedor_id: z.number().int().optional().nullable(),
  vendedor_nome: z.string().optional().nullable(),
  total_pedido: z.number().optional().nullable(),
  nf_numero: z.number().int().optional().nullable(),
  data_entrega: z.string().optional().nullable(),
  motivo_cancelamento: z.string().optional().nullable(),
  etapa: z.string(),
  etapa_ordem: z.number().int().optional().nullable(),
  finalizado: z.boolean().optional().nullable(),
  etapa_desde: z.string().optional().nullable(),
  ts_liberacao: z.string().optional().nullable(),
  usuario_liberacao: z.string().optional().nullable(),
  ts_separacao: z.string().optional().nullable(),
  usuario_separacao: z.string().optional().nullable(),
  ts_conferencia: z.string().optional().nullable(),
  usuario_conferencia: z.string().optional().nullable(),
  ts_expedicao: z.string().optional().nullable(),
  usuario_expedicao: z.string().optional().nullable(),
  ts_faturamento: z.string().optional().nullable(),
  usuario_faturamento: z.string().optional().nullable(),
  ts_boleto: z.string().optional().nullable(),
  usuario_boleto: z.string().optional().nullable(),
  ts_entrega: z.string().optional().nullable(),
  entrega_local: z.string().optional().nullable(),
  entrega_obs: z.string().optional().nullable(),
  tem_canhoto: z.boolean().optional().nullable(),
  tempo_digitacao_lib_min: z.number().int().optional().nullable(),
  tempo_aguard_separacao_min: z.number().int().optional().nullable(),
  tempo_separacao_min: z.number().int().optional().nullable(),
  tempo_aguard_expedicao_min: z.number().int().optional().nullable(),
  tempo_faturamento_min: z.number().int().optional().nullable(),
  tempo_entrega_min: z.number().int().optional().nullable(),
  lead_time_min: z.number().int().optional().nullable(),
  lead_time_entrega_min: z.number().int().optional().nullable(),
  itens: z.array(ItemSchema).default([]),
}).passthrough();

const BodySchema = z.object({
  tipo: z.string(),
  periodo_de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  periodo_ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  pedidos: z.array(PedidoSchema).min(0).max(5_000),
}).strict();

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 60, rateLimitPrefix: "receber-pedidos-rubysp", skipWaf: true },
  async (req) => {
    const cors = getCorsHeaders(req);
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

    // Aceita o token Rubysp OU o token Futura, para um único bearer no conector.
    const tokRubysp = Deno.env.get("RUBYSP_SYNC_TOKEN") ?? "";
    const tokFutura = Deno.env.get("FUTURA_SYNC_TOKEN") ?? "";
    if (!tokRubysp && !tokFutura) return json(500, { error: "server_misconfigured" });

    const authHeader = req.headers.get("Authorization") ?? "";
    const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const ok =
      (!!tokRubysp && constantTimeEquals(provided, tokRubysp)) ||
      (!!tokFutura && constantTimeEquals(provided, tokFutura));
    if (!provided || !ok) {
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
    const { periodo_de, periodo_ate, pedidos } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date().toISOString();
    let pedidosUpserted = 0;
    let itensUpserted = 0;
    const errors: Array<{ rubysp_pedido_id: number; error: string }> = [];

    try {
      for (const p of pedidos) {
        const { itens, ...rest } = p;
        const header: Record<string, unknown> = {
          rubysp_pedido_id: rest.rubysp_pedido_id,
          empresa_id: rest.empresa_id ?? null,
          data_pedido: rest.data_pedido ?? null,
          digitacao_inicio: rest.digitacao_inicio ?? null,
          digitacao_fim: rest.digitacao_fim ?? null,
          status: rest.status ?? null,
          operacao_id: rest.operacao_id ?? null,
          operacao_desc: rest.operacao_desc ?? null,
          bonificacao: rest.bonificacao ?? false,
          romaneio_id: rest.romaneio_id ?? null,
          pedido_venda_relacionado: rest.pedido_venda_relacionado ?? null,
          cliente_id: rest.cliente_id ?? null,
          cliente_nome: rest.cliente_nome ?? null,
          cliente_cnpj: rest.cliente_cnpj ?? null,
          cliente_cidade: rest.cliente_cidade ?? null,
          cliente_uf: rest.cliente_uf ?? null,
          cond_pagamento_id: rest.cond_pagamento_id ?? null,
          cond_pagamento_desc: rest.cond_pagamento_desc ?? null,
          endereco_logradouro: rest.endereco_logradouro ?? null,
          endereco_numero: rest.endereco_numero ?? null,
          endereco_bairro: rest.endereco_bairro ?? null,
          endereco_cep: rest.endereco_cep ?? null,
          endereco_entrega: rest.endereco_entrega ?? null,
          vendedor_id: rest.vendedor_id ?? null,
          vendedor_nome: rest.vendedor_nome ?? null,
          total_pedido: rest.total_pedido ?? null,
          nf_numero: rest.nf_numero ?? null,
          data_entrega: rest.data_entrega ?? null,
          motivo_cancelamento: rest.motivo_cancelamento ?? null,
          etapa: rest.etapa,
          etapa_ordem: rest.etapa_ordem ?? null,
          finalizado: rest.finalizado ?? false,
          etapa_desde: rest.etapa_desde ?? null,
          ts_liberacao: rest.ts_liberacao ?? null,
          usuario_liberacao: rest.usuario_liberacao ?? null,
          ts_separacao: rest.ts_separacao ?? null,
          usuario_separacao: rest.usuario_separacao ?? null,
          ts_conferencia: rest.ts_conferencia ?? null,
          usuario_conferencia: rest.usuario_conferencia ?? null,
          ts_expedicao: rest.ts_expedicao ?? null,
          usuario_expedicao: rest.usuario_expedicao ?? null,
          ts_faturamento: rest.ts_faturamento ?? null,
          usuario_faturamento: rest.usuario_faturamento ?? null,
          ts_boleto: rest.ts_boleto ?? null,
          usuario_boleto: rest.usuario_boleto ?? null,
          ts_entrega: rest.ts_entrega ?? null,
          entrega_local: rest.entrega_local ?? null,
          entrega_obs: rest.entrega_obs ?? null,
          tem_canhoto: rest.tem_canhoto ?? false,
          tempo_digitacao_lib_min: rest.tempo_digitacao_lib_min ?? null,
          tempo_aguard_separacao_min: rest.tempo_aguard_separacao_min ?? null,
          tempo_separacao_min: rest.tempo_separacao_min ?? null,
          tempo_aguard_expedicao_min: rest.tempo_aguard_expedicao_min ?? null,
          tempo_faturamento_min: rest.tempo_faturamento_min ?? null,
          tempo_entrega_min: rest.tempo_entrega_min ?? null,
          lead_time_min: rest.lead_time_min ?? null,
          lead_time_entrega_min: rest.lead_time_entrega_min ?? null,
          raw: p as unknown as Record<string, unknown>,
          sincronizado_em: now,
        };

        const { error: upErr } = await supabase
          .from("erp_pedidos_rubysp")
          .upsert(header, { onConflict: "rubysp_pedido_id" });
        if (upErr) {
          errors.push({ rubysp_pedido_id: rest.rubysp_pedido_id, error: `header: ${upErr.message}` });
          continue;
        }
        pedidosUpserted++;

        const { error: delErr } = await supabase
          .from("erp_pedido_itens_rubysp")
          .delete()
          .eq("rubysp_pedido_id", rest.rubysp_pedido_id);
        if (delErr) {
          errors.push({ rubysp_pedido_id: rest.rubysp_pedido_id, error: `del itens: ${delErr.message}` });
          continue;
        }

        if (itens.length > 0) {
          const itemRows = itens.map((it) => ({
            rubysp_pedido_id: rest.rubysp_pedido_id,
            sequencia: it.sequencia,
            produto_id: it.produto_id ?? it.produto_rubysp_id ?? null,
            descricao: it.descricao ?? null,
            ean: it.ean ?? null,
            unidade: it.unidade ?? it.unidade_sigla ?? null,
            quantidade: it.quantidade ?? null,
            preco: it.preco ?? it.valor_unitario ?? null,
            desconto: it.desconto ?? it.desconto_valor ?? null,
            total_item: it.total_item ?? null,
          }));
          const { data: insData, error: insErr } = await supabase
            .from("erp_pedido_itens_rubysp")
            .insert(itemRows)
            .select("id");
          if (insErr) {
            errors.push({ rubysp_pedido_id: rest.rubysp_pedido_id, error: `ins itens: ${insErr.message}` });
            continue;
          }
          itensUpserted += insData?.length ?? 0;
        }
      }


      const ok = errors.length === 0;
      await supabase.from("sync_log_rubysp").insert({
        origem: "pedidos",
        periodo_de: periodo_de ?? null,
        periodo_ate: periodo_ate ?? null,
        pedidos_qtd: pedidosUpserted,
        itens_qtd: itensUpserted,
        ok,
        detalhe: ok ? null : JSON.stringify(errors).slice(0, 4000),
      });

      return json(ok ? 200 : 207, {
        ok,
        pedidos_upserted: pedidosUpserted,
        itens_upserted: itensUpserted,
        ...(ok ? {} : { errors }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.from("sync_log_rubysp").insert({
        origem: "pedidos",
        periodo_de: periodo_de ?? null,
        periodo_ate: periodo_ate ?? null,
        pedidos_qtd: pedidosUpserted,
        itens_qtd: itensUpserted,
        ok: false,
        detalhe: msg.slice(0, 4000),
      });
      return json(500, { error: "internal_error", details: msg });
    }
  },
));
