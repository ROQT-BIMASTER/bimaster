// Recebe fotos diárias do estoque físico do WMS por filial.
// Auth: Bearer RUBYSP_SYNC_TOKEN ou FUTURA_SYNC_TOKEN.
// Contrato: POST { linhas: [...] } — máx. 5.000/lote.
// Chave de conflito: (empresa_result, data_foto).
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const LinhaSchema = z.object({
  empresa_result: z.number().int(),
  data_foto: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  produtos: z.number().int().nullable().optional(),
  unidades: z.number().nullable().optional(),
  valor_ultimo_custo: z.number().nullable().optional(),
  valor_custo_familia: z.number().nullable().optional(),
}).strict();

const BodySchema = z.object({
  linhas: z.array(LinhaSchema).min(1).max(5_000),
}).strict();

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 60, rateLimitPrefix: "receber-estoque-fisico", skipWaf: true },
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
    let upserted = 0;
    const errors: Array<{ key: string; error: string }> = [];

    try {
      const chunkSize = 500;
      for (let i = 0; i < linhas.length; i += chunkSize) {
        const chunk = linhas.slice(i, i + chunkSize);
        const rows = chunk.map((l) => ({
          empresa_result: l.empresa_result,
          data_foto: l.data_foto,
          produtos: l.produtos ?? null,
          unidades: l.unidades ?? null,
          valor_ultimo_custo: l.valor_ultimo_custo ?? null,
          valor_custo_familia: l.valor_custo_familia ?? null,
          sincronizado_em: now,
        }));
        const { error: upErr } = await supabase
          .from("erp_estoque_fisico")
          .upsert(rows, { onConflict: "empresa_result,data_foto" });
        if (upErr) {
          for (const r of chunk) {
            errors.push({
              key: `${r.empresa_result}/${r.data_foto}`,
              error: upErr.message,
            });
          }
          continue;
        }
        upserted += rows.length;
      }

      const success = errors.length === 0;
      await supabase.from("sync_log_rubysp").insert({
        origem: "estoque_fisico",
        pedidos_qtd: upserted,
        itens_qtd: 0,
        ok: success,
        detalhe: success ? "ok" : JSON.stringify(errors).slice(0, 4000),
      });

      return json(success ? 200 : 207, {
        ok: success,
        recebidas: linhas.length,
        upserted,
        ...(success ? {} : { errors }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.from("sync_log_rubysp").insert({
        origem: "estoque_fisico",
        pedidos_qtd: upserted,
        itens_qtd: 0,
        ok: false,
        detalhe: msg.slice(0, 4000),
      });
      return json(500, { error: "internal_error", details: msg });
    }
  },
));
