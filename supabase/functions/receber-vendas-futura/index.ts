// Recebe lotes de vendas (NOTA_FISCAL + itens) do Sistema Futura via conector externo.
// Auth: Bearer FUTURA_SYNC_TOKEN (mesmo secret do conector de estoque).
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

const VendaSchema = z.object({
  futura_nota_id: z.number().int(),
  empresa_id: z.number().int(),
  nro_nota: z.number().int().optional().nullable(),
  serie: z.string().optional().nullable(),
  modelo_doc: z.number().int().optional().nullable(),
  cfop_id: z.number().int().optional().nullable(),
  tipo_pedido_id: z.number().int().optional().nullable(),
  data_emissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cliente_futura_id: z.number().int().optional().nullable(),
  cliente_nome: z.string().optional().nullable(),
  cliente_cnpj_cpf: z.string().optional().nullable(),
  vendedor_futura_id: z.number().int().optional().nullable(),
  quantidade: z.number().optional().nullable(),
  total_produto: z.number().optional().nullable(),
  total_desconto: z.number().optional().nullable(),
  total_nota: z.number().optional().nullable(),
  status: z.number().int(),
  entrada_saida: z.string().min(1).max(1).optional().nullable(),
  itens: z.array(ItemSchema).default([]),
}).strict();

const BodySchema = z.object({
  tipo: z.enum(["full", "incremental"]),
  periodo_de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  periodo_ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  vendas: z.array(VendaSchema).min(1).max(5_000),
}).strict();

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 60, rateLimitPrefix: "receber-vendas-futura", skipWaf: true },
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
    const { tipo, periodo_de, periodo_ate, vendas } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: logRow, error: logErr } = await supabase
      .from("erp_vendas_sync_log")
      .insert({
        tipo,
        periodo_de: periodo_de ?? null,
        periodo_ate: periodo_ate ?? null,
        notas_recebidas: vendas.length,
        status: "em_andamento",
      })
      .select("id")
      .single();
    if (logErr) return json(500, { error: "log_insert_failed", details: logErr.message });
    const logId = logRow.id as number;

    const finalizeError = async (message: string) => {
      await supabase
        .from("erp_vendas_sync_log")
        .update({
          finished_at: new Date().toISOString(),
          status: "erro",
          erro: message,
        })
        .eq("id", logId);
    };

    try {
      const now = new Date().toISOString();

      const notaRows = vendas.map((v) => {
        const { itens: _itens, ...header } = v;
        return {
          futura_nota_id: v.futura_nota_id,
          empresa_id: v.empresa_id,
          nro_nota: v.nro_nota ?? null,
          serie: v.serie ?? null,
          modelo_doc: v.modelo_doc ?? null,
          cfop_id: v.cfop_id ?? null,
          tipo_pedido_id: v.tipo_pedido_id ?? null,
          data_emissao: v.data_emissao,
          cliente_futura_id: v.cliente_futura_id ?? null,
          cliente_nome: v.cliente_nome ?? null,
          cliente_cnpj_cpf: v.cliente_cnpj_cpf ?? null,
          vendedor_futura_id: v.vendedor_futura_id ?? null,
          quantidade: v.quantidade ?? null,
          total_produto: v.total_produto ?? null,
          total_desconto: v.total_desconto ?? null,
          total_nota: v.total_nota ?? null,
          status: v.status,
          entrada_saida: v.entrada_saida ?? null,
          raw: header as unknown as Record<string, unknown>,
          sincronizado_em: now,
        };
      });

      const { error: notaErr, count: notaCount } = await supabase
        .from("erp_vendas")
        .upsert(notaRows, { onConflict: "futura_nota_id", count: "exact" });
      if (notaErr) {
        await finalizeError(notaErr.message);
        return json(500, { error: "vendas_upsert_failed", details: notaErr.message });
      }

      const itemRows = vendas.flatMap((v) =>
        v.itens.map((it) => ({
          futura_item_id: it.futura_item_id,
          futura_nota_id: v.futura_nota_id,
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
        }))
      );

      let itensUpserted = 0;
      if (itemRows.length > 0) {
        const { error: itemErr, count: itemCount } = await supabase
          .from("erp_vendas_item")
          .upsert(itemRows, { onConflict: "futura_item_id", count: "exact" });
        if (itemErr) {
          await finalizeError(itemErr.message);
          return json(500, { error: "itens_upsert_failed", details: itemErr.message });
        }
        itensUpserted = itemCount ?? itemRows.length;
      }

      const notasUpserted = notaCount ?? notaRows.length;

      await supabase
        .from("erp_vendas_sync_log")
        .update({
          finished_at: new Date().toISOString(),
          status: "ok",
          notas_upserted: notasUpserted,
          itens_upserted: itensUpserted,
        })
        .eq("id", logId);

      return json(200, {
        ok: true,
        notas_upserted: notasUpserted,
        itens_upserted: itensUpserted,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await finalizeError(msg);
      return json(500, { error: "internal_error", details: msg });
    }
  },
));
