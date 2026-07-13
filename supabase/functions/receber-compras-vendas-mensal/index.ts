// Recebe agregado mensal Compras × Vendas do ERP Result e faz upsert em erp_compras_vendas_mensal.
// Auth: Bearer RUBYSP_SYNC_TOKEN ou FUTURA_SYNC_TOKEN.
// Contrato: POST { linhas: [...] } — chave de conflito (empresa_result, mes).
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const LinhaSchema = z.object({
  empresa_result: z.number().int(),
  mes: z.string().min(1), // 'YYYY-MM-01'
  compras_revenda: z.number().optional().nullable(),
  compras_uso_consumo: z.number().optional().nullable(),
  devolucoes_venda: z.number().optional().nullable(),
  transferencias: z.number().optional().nullable(),
  vendas_preco: z.number().optional().nullable(),
  vendas_ultimo_custo: z.number().optional().nullable(),
  vendas_custo_familia: z.number().optional().nullable(),
}).strict();

const BodySchema = z.object({
  linhas: z.array(LinhaSchema).min(0).max(5_000),
}).strict();

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 60, rateLimitPrefix: "receber-compras-vendas-mensal", skipWaf: true },
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
    const { linhas } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date().toISOString();
    let staged = 0;
    const errors: Array<{ key: string; error: string }> = [];

    try {
      const chunkSize = 500;
      for (let i = 0; i < linhas.length; i += chunkSize) {
        const chunk = linhas.slice(i, i + chunkSize);
        const rows = chunk.map((l) => ({
          empresa_result: l.empresa_result,
          mes: l.mes,
          compras_revenda: l.compras_revenda ?? null,
          compras_uso_consumo: l.compras_uso_consumo ?? null,
          devolucoes_venda: l.devolucoes_venda ?? null,
          transferencias: l.transferencias ?? null,
          vendas_preco: l.vendas_preco ?? null,
          vendas_ultimo_custo: l.vendas_ultimo_custo ?? null,
          vendas_custo_familia: l.vendas_custo_familia ?? null,
          sincronizado_em: now,
        }));
        const { error: upErr } = await supabase
          .from("erp_compras_vendas_mensal")
          .upsert(rows, { onConflict: "empresa_result,mes" });
        if (upErr) {
          for (const r of chunk) {
            errors.push({ key: `${r.empresa_result}/${r.mes}`, error: upErr.message });
          }
          continue;
        }
        staged += rows.length;
      }

      const success = errors.length === 0;
      await supabase.from("sync_log_rubysp").insert({
        origem: "compras_vendas_mensal",
        pedidos_qtd: staged,
        itens_qtd: 0,
        ok: success,
        detalhe: success ? null : JSON.stringify(errors).slice(0, 4000),
      });

      return json(success ? 200 : 207, {
        ok: success,
        staged,
        ...(success ? {} : { errors }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.from("sync_log_rubysp").insert({
        origem: "compras_vendas_mensal",
        pedidos_qtd: staged,
        itens_qtd: 0,
        ok: false,
        detalhe: msg.slice(0, 4000),
      });
      return json(500, { error: "internal_error", details: msg });
    }
  },
));
