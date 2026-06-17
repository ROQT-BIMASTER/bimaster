// Recebe lotes de estoque do fornecedor (Sistema Futura) via conector externo.
// Auth: Bearer FUTURA_SYNC_TOKEN (token compartilhado) — conector não tem JWT do backend.
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const ItemSchema = z.object({
  empresa_id: z.number().int(),
  empresa_nome: z.string().optional().nullable(),
  ean_caixa: z.string().optional().nullable(),
  codigo_produto: z.string().min(1),
  descricao: z.string().optional().nullable(),
  estoque_caixas: z.number(),
  unidade: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  data_atualizacao: z.string().optional().nullable(),
}).strict();

const BodySchema = z.object({
  tipo: z.enum(["full", "incremental"]),
  itens: z.array(ItemSchema).min(1).max(10_000),
}).strict();

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 60, rateLimitPrefix: "receber-estoque-fornecedor", skipWaf: true },
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
    const { tipo, itens } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Abre log
    const { data: logRow, error: logErr } = await supabase
      .from("fornecedor_estoque_sync_log")
      .insert({
        tipo,
        linhas_recebidas: itens.length,
        status: "em_andamento",
      })
      .select("id")
      .single();

    if (logErr) {
      return json(500, { error: "log_insert_failed", details: logErr.message });
    }
    const logId = logRow.id as number;

    const now = new Date().toISOString();
    const rows = itens.map((it) => ({
      erp_id: `${it.empresa_id}-${it.codigo_produto}`,
      empresa_id: it.empresa_id,
      empresa_nome: it.empresa_nome ?? null,
      ean_caixa: it.ean_caixa ?? null,
      codigo_produto: it.codigo_produto,
      descricao: it.descricao ?? null,
      estoque_caixas: it.estoque_caixas,
      unidade: it.unidade ?? null,
      status: it.status ?? null,
      data_atualizacao_origem: it.data_atualizacao ?? null,
      raw: it as unknown as Record<string, unknown>,
      sincronizado_em: now,
    }));

    const { error: upsertErr, count } = await supabase
      .from("fornecedor_estoque_futura")
      .upsert(rows, { onConflict: "erp_id", count: "exact" });

    if (upsertErr) {
      await supabase
        .from("fornecedor_estoque_sync_log")
        .update({
          finished_at: new Date().toISOString(),
          status: "erro",
          erro: upsertErr.message,
        })
        .eq("id", logId);
      return json(500, { error: "upsert_failed", details: upsertErr.message });
    }

    const upserted = count ?? rows.length;

    await supabase
      .from("fornecedor_estoque_sync_log")
      .update({
        finished_at: new Date().toISOString(),
        status: "ok",
        linhas_upserted: upserted,
      })
      .eq("id", logId);

    return json(200, { ok: true, upserted });
  },
));
