// Recebe lotes de pedidos de venda (cabeçalho + itens) do Sistema Futura via conector externo.
// Auth: Bearer FUTURA_SYNC_TOKEN (mesmo secret usado por estoque/vendas).
// Idempotência: upsert em erp_pedidos por futura_pedido_id e erp_pedidos_item por futura_item_id.
// Trigger erp_pedidos_track_etapa registra mudanças de etapa em erp_pedidos_etapa_log.
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const ItemSchema = z.object({
  futura_item_id: z.number().int(),
  sequencia: z.number().int().optional().nullable(),
  produto_futura_id: z.number().int().optional().nullable(),
  cod_produto: z.string().optional().nullable(),
  ean: z.string().optional().nullable(),
  descricao: z.string().optional().nullable(),
  quantidade: z.number().optional().nullable(),
  valor_unitario: z.number().optional().nullable(),
  desconto_valor: z.number().optional().nullable(),
  total_item: z.number().optional().nullable(),
}).strict();

const PedidoSchema = z.object({
  futura_pedido_id: z.number().int(),
  empresa_id: z.number().int().optional().nullable(),
  nro_pedido: z.string().optional().nullable(),
  tipo_pedido_id: z.number().int().optional().nullable(),
  data_emissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  data_movimentacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  data_previsao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  cliente_futura_id: z.number().int().optional().nullable(),
  cliente_nome: z.string().optional().nullable(),
  cliente_cnpj_cpf: z.string().optional().nullable(),
  vendedor_futura_id: z.number().int().optional().nullable(),
  status: z.number().int().optional().nullable(),
  situacao_id: z.number().int().optional().nullable(),
  situacao_desc: z.string().optional().nullable(),
  cond_pagto_id: z.number().int().optional().nullable(),
  cond_pagto_desc: z.string().optional().nullable(),
  nf_numero: z.number().int().optional().nullable(),
  endereco_entrega: z.string().optional().nullable(),
  endereco_cep: z.string().optional().nullable(),
  rastreio_link: z.string().optional().nullable(),
  etapa: z.string().min(1),
  etapa_ordem: z.number().int().optional().nullable(),
  urgente: z.boolean().optional().nullable(),
  total_produto: z.number().optional().nullable(),
  total_desconto: z.number().optional().nullable(),
  total_pedido: z.number().optional().nullable(),
  observacao: z.string().optional().nullable(),
  data_cancelamento: z.string().optional().nullable(),
  motivo_cancelamento: z.string().optional().nullable(),
  itens: z.array(ItemSchema).optional().nullable(),
}).strict();

const BodySchema = z.object({
  tipo: z.enum(["full", "incremental"]),
  periodo_de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  periodo_ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  pedidos: z.array(PedidoSchema).min(1).max(5_000),
}).strict();

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 60, rateLimitPrefix: "receber-pedidos-futura", skipWaf: true },
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
    const { tipo, periodo_de, periodo_ate, pedidos } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: logRow, error: logErr } = await supabase
      .from("erp_pedidos_sync_log")
      .insert({
        tipo,
        periodo_de: periodo_de ?? null,
        periodo_ate: periodo_ate ?? null,
        pedidos_recebidos: pedidos.length,
        status: "em_andamento",
      })
      .select("id")
      .single();
    if (logErr) return json(500, { error: "log_insert_failed", details: logErr.message });
    const logId = logRow.id as number;

    const finalizeError = async (message: string) => {
      await supabase
        .from("erp_pedidos_sync_log")
        .update({
          finished_at: new Date().toISOString(),
          status: "erro",
          erro: message,
        })
        .eq("id", logId);
    };

    try {
      const now = new Date().toISOString();

      const rows = pedidos.map((p) => {
        // raw do cabeçalho não inclui 'itens' (mesmo padrão de erp_vendas)
        const { itens: _itens, ...header } = p;
        return {
          futura_pedido_id: p.futura_pedido_id,
          empresa_id: p.empresa_id ?? null,
          nro_pedido: p.nro_pedido ?? null,
          tipo_pedido_id: p.tipo_pedido_id ?? null,
          data_emissao: p.data_emissao ?? null,
          data_movimentacao: p.data_movimentacao ?? null,
          data_previsao: p.data_previsao ?? null,
          cliente_futura_id: p.cliente_futura_id ?? null,
          cliente_nome: p.cliente_nome ?? null,
          cliente_cnpj_cpf: p.cliente_cnpj_cpf ?? null,
          vendedor_futura_id: p.vendedor_futura_id ?? null,
          status: p.status ?? null,
          situacao_id: p.situacao_id ?? null,
          situacao_desc: p.situacao_desc ?? null,
          cond_pagto_id: p.cond_pagto_id ?? null,
          cond_pagto_desc: p.cond_pagto_desc ?? null,
          nf_numero: p.nf_numero ?? null,
          endereco_entrega: p.endereco_entrega ?? null,
          endereco_cep: p.endereco_cep ?? null,
          rastreio_link: p.rastreio_link ?? null,
          etapa: p.etapa,
          etapa_ordem: p.etapa_ordem ?? null,
          urgente: p.urgente ?? false,
          total_produto: p.total_produto ?? null,
          total_desconto: p.total_desconto ?? null,
          total_pedido: p.total_pedido ?? null,
          observacao: p.observacao ?? null,
          data_cancelamento: p.data_cancelamento ?? null,
          motivo_cancelamento: p.motivo_cancelamento ?? null,
          raw: header as unknown as Record<string, unknown>,
          sincronizado_em: now,
        };
      });

      const { error: upErr, count } = await supabase
        .from("erp_pedidos")
        .upsert(rows, { onConflict: "futura_pedido_id", count: "exact" });
      if (upErr) {
        await finalizeError(upErr.message);
        return json(500, { error: "pedidos_upsert_failed", details: upErr.message });
      }

      const pedidosUpserted = count ?? rows.length;

      // Itens: agrega de todos os pedidos do lote; pedido sem 'itens' -> ignorado.
      const itemRows: Array<Record<string, unknown>> = [];
      for (const p of pedidos) {
        if (!p.itens || p.itens.length === 0) continue;
        for (const it of p.itens) {
          itemRows.push({
            futura_item_id: it.futura_item_id,
            futura_pedido_id: p.futura_pedido_id,
            sequencia: it.sequencia ?? null,
            produto_futura_id: it.produto_futura_id ?? null,
            cod_produto: it.cod_produto ?? null,
            ean: it.ean ?? null,
            descricao: it.descricao ?? null,
            quantidade: it.quantidade ?? null,
            valor_unitario: it.valor_unitario ?? null,
            desconto_valor: it.desconto_valor ?? null,
            total_item: it.total_item ?? null,
            raw: it as unknown as Record<string, unknown>,
            sincronizado_em: now,
          });
        }
      }

      let itensUpserted = 0;
      if (itemRows.length > 0) {
        const { error: itErr, count: itCount } = await supabase
          .from("erp_pedidos_item")
          .upsert(itemRows, { onConflict: "futura_item_id", count: "exact" });
        if (itErr) {
          await finalizeError(itErr.message);
          return json(500, { error: "itens_upsert_failed", details: itErr.message });
        }
        itensUpserted = itCount ?? itemRows.length;
      }

      await supabase
        .from("erp_pedidos_sync_log")
        .update({
          finished_at: new Date().toISOString(),
          status: "ok",
          pedidos_upserted: pedidosUpserted,
          itens_upserted: itensUpserted,
        })
        .eq("id", logId);

      return json(200, {
        ok: true,
        pedidos_upserted: pedidosUpserted,
        itens_upserted: itensUpserted,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await finalizeError(msg);
      return json(500, { error: "internal_error", details: msg });
    }
  },
));
