// classify-natureza-erp — classifica cada natureza ERP (custo_tpg, historico_tpg)
// em uma conta do chart_of_accounts_v2 (IFRS 18) usando o Lovable AI Gateway.
//
// Chamada:
//   POST /functions/v1/classify-natureza-erp
//   Body: { limit?: number (default 50), only_pending?: boolean (default true), model?: string }
//
// Regras:
//   - Só admin
//   - Só processa naturezas ainda em 'pendente_auditoria' quando only_pending=true
//   - Ordena por volume_12m DESC (auditar as maiores primeiro rende cobertura de valor)
//   - Grava sugestão na tabela natureza_erp_classificacao_ia com status='pendente_auditoria'
//   - Auditoria humana troca status para 'aprovada' | 'editada' | 'rejeitada'

import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";

const Body = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  only_pending: z.boolean().optional(),
  model: z.string().optional(),
}).strict();

// Catálogo de códigos válidos (será injetado no prompt como referência viva).
async function fetchCatalog(sb: any): Promise<Array<{ code: string; name: string; tipo: string; funcao: string; analitica: boolean }>> {
  const { data, error } = await sb
    .from("chart_of_accounts_v2")
    .select("code, name, tipo, funcao_operacional, analitica, ativo")
    .eq("ativo", true)
    .order("code");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    code: r.code,
    name: r.name,
    tipo: r.tipo,
    funcao: r.funcao_operacional,
    analitica: !!r.analitica,
  }));
}

const SYSTEM_PROMPT = `Você é um contador sênior brasileiro especialista em IFRS 18 e no plano de contas por natureza + função operacional.

Sua tarefa: dada uma "natureza" do ERP (combinação de centro de custo, histórico contábil, categoria dominante e principais fornecedores), classificá-la EXATAMENTE em UMA conta analítica do plano IFRS 18 fornecido.

Regras rígidas:
1. Escolha SEMPRE um code que exista no catálogo. Nunca invente code.
2. Prefira contas ANALÍTICAS (analitica=true). Só use sintéticas quando nenhuma analítica couber e a resposta correta seja mesmo sintética.
3. A função_operacional deve corresponder à do code escolhido no catálogo (não invente valor conflitante).
4. Considere:
   - "Frete" de compras → 5.5. Frete de venda → 6.1.04. Frete interno/transferência → 6.3.02.
   - "Marketing" / "publicidade" / "mídia" → 6.1.02. "Trade" / "PDV" / "material promocional" → 6.1.03.
   - "Aluguel de fábrica" → 5.4 (CIF). "Aluguel de escritório/administrativo" → 6.2.05.
   - "Salário" da produção → 5.3. "Salário administrativo" → 6.2.01. "Comissão" → 6.1.01.
   - "Energia/água/telecom" administrativa → 6.2.06. "Energia da fábrica" → 5.4.
   - "SaaS/software" → 6.2.07. "Consultoria contábil" → 6.2.04. "Consultoria geral" → 6.2.03.
   - "Juros de empréstimo pago" → 7.2.01. "IOF" → 7.2.03. "Tarifas bancárias" → 7.2.02.
   - "Impostos sobre venda" (ICMS/PIS/COFINS/ISS destacados na nota) → 4.2.02. "IRPJ" → 9.1. "CSLL" → 9.2.
   - "PDD/perdas com clientes" → 6.4.02. "Perdas de estoque/inventário" → 6.4.01.
5. Se genuinamente ambíguo, coloque em uma conta 6.4.* (Outras Despesas Operacionais) e explique no rationale.
6. confidence: 0-1. Use ≥0.85 quando o mapeamento for direto; 0.5-0.8 quando plausível mas com ambiguidade; <0.5 quando pouco certo.
7. Devolva APENAS JSON válido, sem markdown, sem prosa antes/depois.`;

function buildUserPrompt(nat: any, catalog: string): string {
  return `Catálogo IFRS 18 (code | tipo | função | nome | analítica):
${catalog}

Natureza a classificar:
- Centro de custo: [${nat.custo_tpg}] ${nat.ccusto_nome ?? "(sem nome)"}
- Histórico contábil: [${nat.historico_tpg}] ${nat.historico_nome ?? "(sem nome)"}
- Categoria dominante: ${nat.categoria_dominante ?? "(nenhuma)"}
- Setor ERP dominante: ${nat.setor_erp ?? "(nenhum)"}
- Volume últimos 12 meses: R$ ${Number(nat.volume_12m ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Quantidade de títulos: ${nat.qtd_titulos ?? 0}
- Top fornecedores: ${nat.top_fornecedores ?? "(nenhum)"}

Responda em JSON exatamente com as chaves:
{"conta_code_v2": "<code do catálogo>", "conta_name_v2": "<nome exato do catálogo>", "tipo": "<tipo do catálogo>", "funcao_operacional": "<função do catálogo>", "confidence": <0-1>, "rationale": "<uma linha em português>"}`;
}

function extractJson(text: string): any | null {
  if (!text) return null;
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { return null; }
    }
    return null;
  }
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 6, rateLimitPrefix: "classify-natureza" },
  async (req, ctx) => {
    const cors = getCorsHeaders(req);

    // Só admin
    const userId = ctx.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden: admin only" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(raw);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const limit       = parsed.data.limit ?? 50;
    const onlyPending = parsed.data.only_pending ?? true;
    const model       = parsed.data.model ?? "google/gemini-3-flash-preview";
    const iaRunId     = crypto.randomUUID();

    // 1) Catálogo IFRS 18
    const catalog = await fetchCatalog(sb);
    const catalogText = catalog
      .map(c => `${c.code} | ${c.tipo} | ${c.funcao} | ${c.name} | ${c.analitica ? "analitica" : "sintetica"}`)
      .join("\n");

    // 2) Todas as naturezas do ERP (aggregate)
    const { data: naturezas, error: natErr } = await sb.rpc("fn_naturezas_erp_para_classificacao");
    if (natErr) {
      return new Response(JSON.stringify({ error: "rpc_naturezas_failed", detail: natErr.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const todas: any[] = (naturezas ?? []) as any[];

    // 3) Se only_pending, exclui as já classificadas + aprovadas/editadas
    let pendentes = todas;
    if (onlyPending) {
      const { data: jaFeitas } = await sb
        .from("natureza_erp_classificacao_ia")
        .select("custo_tpg, historico_tpg, status");
      const chaveFeita = new Set(
        (jaFeitas ?? [])
          .filter((r: any) => r.status !== "rejeitada")
          .map((r: any) => `${r.custo_tpg ?? "null"}|${r.historico_tpg ?? "null"}`),
      );
      pendentes = todas.filter(n => !chaveFeita.has(`${n.custo_tpg ?? "null"}|${n.historico_tpg ?? "null"}`));
    }
    pendentes = pendentes.slice(0, limit);

    if (pendentes.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, ia_run_id: iaRunId, message: "nada pendente" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 4) Loop de classificação (sequencial para respeitar rate limits do gateway)
    const codesValidos = new Set(catalog.map(c => c.code));
    let ok = 0, falha = 0;
    const erros: any[] = [];

    for (const nat of pendentes) {
      const r = await callAIGateway({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: buildUserPrompt(nat, catalogText) },
        ],
        timeoutMs: 45_000,
      });

      if (r.kind !== "ok") {
        falha++;
        erros.push({ custo_tpg: nat.custo_tpg, historico_tpg: nat.historico_tpg, error: r.kind });
        // Em 402 (créditos) ou rate-limit persistente, para a batelada
        if (r.kind === "credits_exhausted" || r.kind === "rate_limited") {
          break;
        }
        continue;
      }

      const contentText = r.data?.choices?.[0]?.message?.content ?? "";
      const suggestion = extractJson(contentText);

      if (!suggestion || !suggestion.conta_code_v2 || !codesValidos.has(suggestion.conta_code_v2)) {
        falha++;
        erros.push({
          custo_tpg: nat.custo_tpg, historico_tpg: nat.historico_tpg,
          error: "invalid_code_or_json",
          raw: contentText?.slice(0, 400) ?? null,
        });
        continue;
      }

      const catRow = catalog.find(c => c.code === suggestion.conta_code_v2)!;

      const { error: upErr } = await sb
        .from("natureza_erp_classificacao_ia")
        .upsert({
          custo_tpg:            nat.custo_tpg,
          historico_tpg:        nat.historico_tpg,
          ccusto_nome:          nat.ccusto_nome,
          historico_nome:       nat.historico_nome,
          setor_erp:            nat.setor_erp,
          volume_12m:           nat.volume_12m,
          qtd_titulos:          nat.qtd_titulos,
          top_fornecedores:     nat.top_fornecedores,
          categoria_dominante:  nat.categoria_dominante,
          conta_code_v2:        suggestion.conta_code_v2,
          conta_name_v2:        catRow.name,
          tipo:                 catRow.tipo,
          natureza:             suggestion.natureza ?? null,
          funcao_operacional:   catRow.funcao,
          confidence:           Math.max(0, Math.min(1, Number(suggestion.confidence ?? 0))),
          rationale:            String(suggestion.rationale ?? "").slice(0, 500),
          model,
          ia_run_id:            iaRunId,
          status:               "pendente_auditoria",
        }, { onConflict: "custo_tpg,historico_tpg" });

      if (upErr) {
        falha++;
        erros.push({ custo_tpg: nat.custo_tpg, historico_tpg: nat.historico_tpg, error: "db_upsert_failed", detail: upErr.message });
      } else {
        ok++;
      }

      // pequeno espaçamento para respeitar limites de gateway em alta volumetria
      await new Promise(res => setTimeout(res, 120));
    }

    return new Response(JSON.stringify({
      ok: true,
      ia_run_id: iaRunId,
      processed: pendentes.length,
      inserted_or_updated: ok,
      failed: falha,
      errors_sample: erros.slice(0, 10),
      model,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
));
