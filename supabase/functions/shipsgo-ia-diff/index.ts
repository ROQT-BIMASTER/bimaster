// shipsgo-ia-diff — chama IA com payloads operacional + técnico, retorna markdown e plano de auto-fix.
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";
import { z, validateBody } from "../_shared/validate.ts";
import {
  SHIPSGO_API_FIELDS_OCEAN, SHIPSGO_LOCAL_TABLES, SHIPSGO_WEBHOOK_EVENTS_SUPORTADOS,
} from "../_shared/shipsgo-schema.ts";

const Schema = z.object({
  divergencias: z.array(z.any()).max(500),
  kpis: z.record(z.any()),
}).strict();

const TOOL = {
  type: "function",
  function: {
    name: "return_diff_analysis",
    description: "Devolve a análise estruturada da integração ShipsGo.",
    parameters: {
      type: "object",
      properties: {
        relatorio_md: { type: "string", description: "Relatório completo em markdown PT-BR" },
        resumo: {
          type: "object",
          properties: {
            risco_geral: { type: "string", enum: ["baixo", "medio", "alto", "critico"] },
            top_findings: { type: "array", items: { type: "string" }, maxItems: 8 },
          },
          required: ["risco_geral", "top_findings"],
        },
        plano_autofix: {
          type: "array",
          maxItems: 100,
          items: {
            type: "object",
            properties: {
              acao: { type: "string", enum: ["sync", "criar_tracking", "desvincular", "reprocessar_webhook"] },
              container: { type: "string" },
              embarque_id: { type: "string" },
              shipment_id: { type: "string" },
              motivo: { type: "string" },
              prioridade: { type: "string", enum: ["P0", "P1", "P2"] },
            },
            required: ["acao", "motivo", "prioridade"],
          },
        },
      },
      required: ["relatorio_md", "resumo", "plano_autofix"],
      additionalProperties: false,
    },
  },
};

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 10, rateLimitPrefix: "shipsgo-ia-diff" },
    async (req, ctx) => {
      const cors = getCorsHeaders(req);
      const json = { ...cors, "Content-Type": "application/json" };

      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: roleRow } = await sb.from("user_roles")
        .select("role").eq("user_id", ctx.userId!).eq("role", "admin").maybeSingle();
      if (!roleRow) {
        return new Response(JSON.stringify({ error: "Acesso restrito" }), { status: 403, headers: json });
      }

      const body = await req.json().catch(() => ({}));
      const { divergencias, kpis } = validateBody(body, Schema);

      const payloadOperacional = {
        kpis,
        amostra_divergencias: divergencias.slice(0, 200),
        total: divergencias.length,
      };
      const payloadTecnico = {
        api_v2_fields: SHIPSGO_API_FIELDS_OCEAN,
        tabelas_locais: SHIPSGO_LOCAL_TABLES,
        webhook_events_suportados: SHIPSGO_WEBHOOK_EVENTS_SUPORTADOS,
      };

      const system = `Você é um auditor sênior de integrações de tracking marítimo.
Compare DOIS lados e gere um relatório acionável:
1) OPERACIONAL — divergências de dados entre china_embarques (local) e ShipsGo (API v2).
2) TÉCNICO — cobertura de schema/eventos: campos da API não persistidos, eventos de webhook não tratados, oportunidades de melhoria.

Saída em markdown PT-BR, profissional, sem emojis. Estrutura obrigatória:
## Diagnóstico operacional
## Cobertura de schema
## Cobertura de eventos
## Recomendações priorizadas (P0/P1/P2)
## Plano de auto-fix sugerido

Sempre devolva via tool call return_diff_analysis com plano_autofix preenchido quando houver itens corrigíveis.`;

      const user = `## Payload operacional
\`\`\`json
${JSON.stringify(payloadOperacional, null, 2)}
\`\`\`

## Payload técnico
\`\`\`json
${JSON.stringify(payloadTecnico, null, 2)}
\`\`\``;

      const result = await callAIGateway({
        model: "openai/gpt-5.2",
        timeoutMs: 90_000,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "return_diff_analysis" } },
      });

      if (result.kind !== "ok") return aiGatewayErrorResponse(result, json);

      const choice = result.data?.choices?.[0]?.message;
      const toolCall = choice?.tool_calls?.[0];
      if (!toolCall) {
        return new Response(JSON.stringify({ error: "IA não retornou análise estruturada" }), { status: 502, headers: json });
      }
      let parsed: any;
      try { parsed = JSON.parse(toolCall.function.arguments); }
      catch {
        return new Response(JSON.stringify({ error: "Falha ao parsear resposta da IA" }), { status: 502, headers: json });
      }

      const { data: saved, error: saveErr } = await sb
        .from("shipsgo_ia_analises")
        .insert({
          created_by: ctx.userId!,
          model: result.modelUsed,
          payload_operacional: payloadOperacional,
          payload_tecnico: payloadTecnico,
          relatorio_md: parsed.relatorio_md ?? "",
          plano_autofix: parsed.plano_autofix ?? [],
          resumo: parsed.resumo ?? {},
        })
        .select("id, created_at")
        .single();

      if (saveErr) {
        console.error("[shipsgo-ia-diff] save error", saveErr);
        return new Response(JSON.stringify({ error: "Falha ao salvar análise" }), { status: 500, headers: json });
      }

      return new Response(JSON.stringify({
        analise_id: saved.id,
        created_at: saved.created_at,
        model: result.modelUsed,
        relatorio_md: parsed.relatorio_md,
        resumo: parsed.resumo,
        plano_autofix: parsed.plano_autofix,
      }), { headers: json });
    },
  ),
);
