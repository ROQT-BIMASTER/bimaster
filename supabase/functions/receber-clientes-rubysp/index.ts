// Recebe lotes de clientes Ruby_SP do conector externo e faz upsert no staging.
// Auth: Bearer RUBYSP_SYNC_TOKEN ou FUTURA_SYNC_TOKEN.
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const ClienteSchema = z.object({
  codigo_erp: z.string(),
  cnpj: z.string().optional().nullable(),
  razao_social: z.string().optional().nullable(),
  nome_fantasia: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  celular: z.string().optional().nullable(),
  endereco: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  uf: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  ibge_codigo: z.number().int().optional().nullable(),
  data_cadastro: z.string().optional().nullable(),
  data_ultima_compra: z.string().optional().nullable(),
  valor_ultima_compra: z.number().optional().nullable(),
  data_maior_compra: z.string().optional().nullable(),
  valor_maior_compra: z.number().optional().nullable(),
  limite_credito: z.number().optional().nullable(),
  inativo: z.boolean().optional().nullable(),
  vendedor_codigo: z.number().int().optional().nullable(),
  vendedor_nome: z.string().optional().nullable(),
  equipe_codigo: z.number().int().optional().nullable(),
  equipe_nome: z.string().optional().nullable(),
  supervisor: z.string().optional().nullable(),
  classificacao: z.number().int().optional().nullable(),
  status_bloqueio: z.string().optional().nullable(),
  raw: z.record(z.unknown()).optional().nullable(),
}).passthrough();

const BodySchema = z.object({
  tipo: z.literal("clientes"),
  lote: z.array(ClienteSchema),
  pagina: z.number().int().optional().nullable(),
  total_paginas: z.number().int().optional().nullable(),
  finalizar: z.boolean().optional().nullable(),
}).passthrough();

const CAMPOS = [
  "codigo_erp", "cnpj", "razao_social", "nome_fantasia", "email", "telefone", "celular",
  "endereco", "bairro", "cidade", "uf", "cep", "ibge_codigo", "data_cadastro",
  "data_ultima_compra", "valor_ultima_compra", "data_maior_compra", "valor_maior_compra",
  "limite_credito", "inativo", "vendedor_codigo", "vendedor_nome", "equipe_codigo",
  "equipe_nome", "supervisor", "classificacao", "status_bloqueio", "raw",
] as const;

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 60, rateLimitPrefix: "receber-clientes-rubysp", skipWaf: true },
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
    const authOk =
      (!!tokRubysp && constantTimeEquals(provided, tokRubysp)) ||
      (!!tokFutura && constantTimeEquals(provided, tokFutura));
    if (!provided || !authOk) return json(401, { error: "unauthorized" });

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
    const { lote, finalizar } = parsed.data;
    if (lote.length > 500) return json(400, { error: "lote_muito_grande", max: 500 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const startedAt = new Date().toISOString();
    const errors: string[] = [];
    let upserts = 0;

    if (lote.length > 0) {
      const rows = lote.map((c) => {
        const row: Record<string, unknown> = { sincronizado_em: new Date().toISOString() };
        for (const k of CAMPOS) {
          const v = (c as Record<string, unknown>)[k];
          if (v !== undefined) row[k] = v;
        }
        return row;
      });

      const { error } = await supabase
        .from("erp_clientes_raw")
        .upsert(rows, { onConflict: "codigo_erp" });
      if (error) errors.push(`upsert: ${error.message}`);
      else upserts = rows.length;
    }

    let aplicado: unknown = null;
    let aplicacao: string | null = null;
    let rpcErro: string | null = null;
    if (finalizar === true) {
      const { data, error } = await supabase.rpc("aplicar_clientes_rp_no_master");
      if (error) {
        // Aplicação não bloqueia a recepção: o pg_cron aplica em até 15 min.
        rpcErro = error.message;
        aplicacao = "agendada_pg_cron";
      } else {
        aplicado = data;
        aplicacao = "aplicada";
      }

      try {
        await supabase.from("erp_sync_log").insert({
          entity_type: "erp_clientes",
          entity_id: crypto.randomUUID(),
          action: "sync",
          direction: "inbound",
          success: errors.length === 0,
          error_message: errors.length ? errors.slice(0, 5).join(" | ") : null,
          duration_ms: Date.now() - new Date(startedAt).getTime(),
          response_payload: { origem: "connector-rubysp", upserts, aplicado, aplicacao, rpc_error: rpcErro },
        });
      } catch (_e) {
        // log é best-effort
      }
    }

    return json(200, {
      ok: errors.length === 0,
      upserts,
      finalizado: finalizar === true,
      aplicado,
      ...(aplicacao ? { aplicacao } : {}),
      ...(errors.length ? { errors } : {}),
    });
  },
));
