// Recebe lotes de fornecedores Ruby_SP do conector externo e faz upsert no staging.
// Auth: Bearer RUBYSP_SYNC_TOKEN ou FUTURA_SYNC_TOKEN.
// Quando snapshot_fim === true, dispara fn_transform_fornecedores_rubysp após o upsert.
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const FornecedorSchema = z.object({
  rubysp_fornecedor_id: z.number().int(),
  empresa_par: z.number().int().optional().nullable(),
  nome: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  prazo_pagamento: z.number().int().optional().nullable(),
  email: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  contato: z.string().optional().nullable(),
  inscricao_estadual: z.string().optional().nullable(),
  endereco: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  uf: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  banco: z.string().optional().nullable(),
  agencia: z.string().optional().nullable(),
  conta: z.string().optional().nullable(),
}).passthrough();

const BodySchema = z.object({
  tipo: z.string(),
  fornecedores: z.array(FornecedorSchema).min(0).max(5_000),
  snapshot_fim: z.boolean().optional().default(false),
}).strict();

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 60, rateLimitPrefix: "receber-fornecedores-rubysp", skipWaf: true },
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
    const { fornecedores, snapshot_fim } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date().toISOString();
    let staged = 0;
    const errors: Array<{ rubysp_fornecedor_id: number; error: string }> = [];

    try {
      // upsert em chunks de 500
      const chunkSize = 500;
      for (let i = 0; i < fornecedores.length; i += chunkSize) {
        const chunk = fornecedores.slice(i, i + chunkSize);
        const rows = chunk.map((f) => ({
          rubysp_fornecedor_id: f.rubysp_fornecedor_id,
          empresa_par: f.empresa_par ?? null,
          nome: f.nome ?? null,
          cnpj: f.cnpj ?? null,
          prazo_pagamento: f.prazo_pagamento ?? null,
          email: f.email ?? null,
          telefone: f.telefone ?? null,
          contato: f.contato ?? null,
          inscricao_estadual: f.inscricao_estadual ?? null,
          endereco: f.endereco ?? null,
          bairro: f.bairro ?? null,
          cidade: f.cidade ?? null,
          uf: f.uf ?? null,
          cep: f.cep ?? null,
          banco: f.banco ?? null,
          agencia: f.agencia ?? null,
          conta: f.conta ?? null,
          raw: f as unknown as Record<string, unknown>,
          sincronizado_em: now,
        }));
        const { error: upErr } = await supabase
          .from("erp_fornecedores_rubysp")
          .upsert(rows, { onConflict: "rubysp_fornecedor_id" });
        if (upErr) {
          for (const r of chunk) {
            errors.push({ rubysp_fornecedor_id: r.rubysp_fornecedor_id, error: upErr.message });
          }
          continue;
        }
        staged += rows.length;
      }

      let transform: { inseridos: number; atualizados: number } | null = null;
      if (snapshot_fim) {
        const { data: tData, error: tErr } = await supabase.rpc(
          "fn_transform_fornecedores_rubysp",
        );
        if (tErr) {
          errors.push({ rubysp_fornecedor_id: 0, error: `transform: ${tErr.message}` });
        } else if (Array.isArray(tData) && tData.length > 0) {
          const row = tData[0] as { inseridos?: number; atualizados?: number };
          transform = {
            inseridos: Number(row.inseridos ?? 0),
            atualizados: Number(row.atualizados ?? 0),
          };
        }
      }

      const success = errors.length === 0;
      const afetados = transform ? transform.inseridos + transform.atualizados : 0;
      await supabase.from("sync_log_rubysp").insert({
        origem: "fornecedores",
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
        origem: "fornecedores",
        pedidos_qtd: staged,
        itens_qtd: 0,
        ok: false,
        detalhe: msg.slice(0, 4000),
      });
      return json(500, { error: "internal_error", details: msg });
    }
  },
));
