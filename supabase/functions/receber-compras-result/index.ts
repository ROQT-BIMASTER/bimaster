// Recebe lote autoritativo do LIVRO DE ENTRADAS do ERP Result e faz upsert no staging.
// Auth: Bearer RUBYSP_SYNC_TOKEN ou FUTURA_SYNC_TOKEN (mesmo padrão dos demais receivers rubysp).
// Contrato: POST { tipo: 'full'|'incremental', compras: [...] } — máx. 5.000/lote.
// Chave de conflito: (empresa_result, fornecedor_id, numero_nota, serie, cfop, cst, aliquota, data_entrada).
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const CompraSchema = z.object({
  empresa_result: z.number().int(),
  fornecedor_id: z.number().int(),
  fornecedor_nome: z.string().optional().nullable(),
  fornecedor_cnpj: z.string().optional().nullable(),
  numero_nota: z.string().min(1),
  serie: z.string(),
  chave_nfe: z.string().optional().nullable(),
  data_emissao: z.string().optional().nullable(),
  data_entrada: z.string().min(1),
  cfop: z.number().int(),
  cst: z.string().optional().nullable(),
  aliquota: z.number(),
  classe: z.enum(["revenda", "uso_consumo", "devolucao_venda", "transferencia", "outros"]),
  valor_contabil: z.number().optional().nullable(),
  base_icms: z.number().optional().nullable(),
  valor_icms: z.number().optional().nullable(),
  base_st: z.number().optional().nullable(),
  valor_st: z.number().optional().nullable(),
  valor_ipi: z.number().optional().nullable(),
}).strict();

const BodySchema = z.object({
  tipo: z.enum(["full", "incremental"]),
  compras: z.array(CompraSchema).min(0).max(5_000),
}).strict();

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 60, rateLimitPrefix: "receber-compras-result", skipWaf: true },
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
    const { tipo, compras } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date().toISOString();
    let staged = 0;
    const errors: Array<{ key: string; error: string }> = [];

    try {
      const chunkSize = 500;
      for (let i = 0; i < compras.length; i += chunkSize) {
        const chunk = compras.slice(i, i + chunkSize);
        const rows = chunk.map((c) => ({
          empresa_result: c.empresa_result,
          fornecedor_id: c.fornecedor_id,
          fornecedor_nome: c.fornecedor_nome ?? null,
          fornecedor_cnpj: c.fornecedor_cnpj ?? null,
          numero_nota: c.numero_nota,
          serie: c.serie,
          chave_nfe: c.chave_nfe ?? null,
          data_emissao: c.data_emissao ?? null,
          data_entrada: c.data_entrada,
          cfop: c.cfop,
          cst: c.cst ?? null,
          aliquota: c.aliquota,
          classe: c.classe,
          valor_contabil: c.valor_contabil ?? null,
          base_icms: c.base_icms ?? null,
          valor_icms: c.valor_icms ?? null,
          base_st: c.base_st ?? null,
          valor_st: c.valor_st ?? null,
          valor_ipi: c.valor_ipi ?? null,
          sincronizado_em: now,
        }));
        const { error: upErr } = await supabase
          .from("erp_compras_result")
          .upsert(rows, { onConflict: "empresa_result,fornecedor_id,numero_nota,serie,cfop,cst,aliquota,data_entrada" });
        if (upErr) {
          for (const r of chunk) {
            errors.push({
              key: `${r.empresa_result}/${r.numero_nota}/${r.cfop}/${r.cst ?? ""}/${r.data_entrada}`,
              error: upErr.message,
            });
          }
          continue;
        }
        staged += rows.length;
      }

      const success = errors.length === 0;
      await supabase.from("sync_log_rubysp").insert({
        origem: "compras_result",
        pedidos_qtd: staged,
        itens_qtd: 0,
        ok: success,
        detalhe: success ? tipo : JSON.stringify(errors).slice(0, 4000),
      });

      return json(success ? 200 : 207, {
        ok: success,
        tipo,
        staged,
        ...(success ? {} : { errors }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.from("sync_log_rubysp").insert({
        origem: "compras_result",
        pedidos_qtd: staged,
        itens_qtd: 0,
        ok: false,
        detalhe: msg.slice(0, 4000),
      });
      return json(500, { error: "internal_error", details: msg });
    }
  },
));
