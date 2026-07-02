// pedidos-copilot — Copiloto especialista em pedidos, rastreamento de carga,
// faturamento e análise comercial da base Futura (v_pedidos).
// Somente leitura. Todas as tools filtram por RLS via JWT do usuário.

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const Body = z.object({
  thread_id: z.string().uuid().optional(),
  user_message: z.string().min(1).max(8000),
  scope: z
    .object({
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      etapa: z.string().optional(),
    })
    .partial()
    .optional(),
  clientActionId: z.string().optional(),
}).passthrough();

const SYSTEM_PROMPT = `Você é o Copiloto de Pedidos & Rastreamento da distribuidora Futura.

ESCOPO:
- Analisa PEDIDOS DE VENDA (v_pedidos), rastreamento de carga, faturamento, vendas por cliente e estatísticas comerciais.
- Fora desse escopo, recuse cordialmente.

REGRAS:
- Sempre em português do Brasil, em markdown enxuto (listas, tabelas quando ajudar).
- Nunca invente números. Para qualquer métrica use as ferramentas disponíveis.
- Cite os pedidos consultados por nº do pedido / cliente.
- Ao usar filtros de data, prefira o intervalo do escopo (scope.date_from/date_to) enviado pela tela. Se ausente, use últimos 30 dias.
- Se uma ferramenta retornar erro ou vazio, explique com clareza.
- Você é READ-ONLY. Nunca prometa executar ações mutativas; apenas gere relatórios e recomendações.

FORMATOS DE SAÍDA:
- Para pedidos: mostre nº, cliente, etapa, dias na etapa e total (R$).
- Para faturamento: agrupe conforme solicitado; sempre mostre total geral, ticket médio e nº pedidos.
- Para "gerar relatório executivo": responda em markdown estruturado (## Título, ### Seções, KPIs, listas, tabelas).`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "kpis_periodo",
      description: "KPIs do período: total pedidos, ticket médio, faturamento total, % atraso, em andamento, atrasados.",
      parameters: {
        type: "object",
        properties: {
          date_from: { type: "string", description: "YYYY-MM-DD (default: 30 dias atrás)" },
          date_to: { type: "string", description: "YYYY-MM-DD (default: hoje)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_pedidos_em_andamento",
      description: "Lista pedidos em andamento (etapas digitacao/aberto/separacao/separado/conferido).",
      parameters: {
        type: "object",
        properties: {
          etapa: { type: "string" },
          dias_min: { type: "integer", description: "Filtra pedidos parados há pelo menos N dias na etapa" },
          cliente: { type: "string", description: "Filtro parcial por nome do cliente" },
          limite: { type: "integer", default: 50 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pedidos_atrasados",
      description: "Lista pedidos com data_previsao vencida ou parados muito tempo na etapa.",
      parameters: {
        type: "object",
        properties: {
          referencia: { type: "string", enum: ["data_previsao", "dias_etapa"], default: "data_previsao" },
          dias: { type: "integer", description: "Se referencia=dias_etapa, considera atraso a partir de N dias na etapa", default: 3 },
          limite: { type: "integer", default: 50 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "novos_pedidos",
      description: "Pedidos emitidos no período recente.",
      parameters: {
        type: "object",
        properties: {
          periodo: { type: "string", enum: ["hoje", "7d", "30d"], default: "hoje" },
          limite: { type: "integer", default: 100 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "vendas_por_cliente",
      description: "Top clientes por faturamento no período (soma total_pedido, contagem, ticket médio).",
      parameters: {
        type: "object",
        properties: {
          date_from: { type: "string" },
          date_to: { type: "string" },
          top_n: { type: "integer", default: 10 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "faturamento_periodo",
      description: "Faturamento agregado por dimensão.",
      parameters: {
        type: "object",
        properties: {
          date_from: { type: "string" },
          date_to: { type: "string" },
          group_by: { type: "string", enum: ["dia", "semana", "mes", "vendedor", "cliente", "etapa"], default: "dia" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "estatisticas_comerciais",
      description: "Estatísticas comerciais: distribuição por etapa, lead time médio, urgência, % atraso.",
      parameters: {
        type: "object",
        properties: {
          date_from: { type: "string" },
          date_to: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detalhar_pedido",
      description: "Detalhes de um pedido específico (etapa, dias na etapa, rastreio, cliente, total, previsão).",
      parameters: {
        type: "object",
        properties: {
          nro_pedido: { type: "string" },
          futura_pedido_id: { type: "integer" },
        },
        additionalProperties: false,
      },
    },
  },
];

type Src = { tipo: string; id: string | number; label: string };
type ToolCtx = { userClient: any; sources: Src[]; scope?: any };

function defaultRange(scope?: any) {
  const to = scope?.date_to ?? new Date().toISOString().slice(0, 10);
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);
  const from = scope?.date_from ?? fromDate.toISOString().slice(0, 10);
  return { from, to };
}

async function execTool(name: string, args: any, c: ToolCtx) {
  try {
    switch (name) {
      case "kpis_periodo": {
        const { from, to } = { from: args.date_from, to: args.date_to, ...defaultRange(c.scope) };
        const { data, error } = await c.userClient
          .from("v_pedidos")
          .select("futura_pedido_id, total_pedido, etapa, em_andamento, data_previsao, dias_na_etapa")
          .gte("data_emissao", from)
          .lte("data_emissao", to)
          .limit(10000);
        if (error) return { error: error.message };
        const rows = (data ?? []) as any[];
        const total = rows.length;
        const faturamento = rows.reduce((s, r) => s + Number(r.total_pedido || 0), 0);
        const ticket_medio = total ? faturamento / total : 0;
        const em_andamento = rows.filter((r) => r.em_andamento).length;
        const hoje = new Date().toISOString().slice(0, 10);
        const atrasados = rows.filter((r) => r.em_andamento && r.data_previsao && r.data_previsao < hoje).length;
        const pct_atraso = em_andamento ? (atrasados / em_andamento) * 100 : 0;
        return {
          periodo: { from, to },
          total_pedidos: total,
          faturamento_total: Number(faturamento.toFixed(2)),
          ticket_medio: Number(ticket_medio.toFixed(2)),
          em_andamento,
          atrasados,
          pct_atraso: Number(pct_atraso.toFixed(1)),
        };
      }
      case "listar_pedidos_em_andamento": {
        let q = c.userClient
          .from("v_pedidos")
          .select("futura_pedido_id, nro_pedido, cliente_nome, etapa, dias_na_etapa, total_pedido, data_previsao, urgente")
          .eq("em_andamento", true)
          .order("dias_na_etapa", { ascending: false })
          .limit(Math.min(args.limite ?? 50, 200));
        if (args.etapa) q = q.eq("etapa", args.etapa);
        if (args.cliente) q = q.ilike("cliente_nome", `%${args.cliente}%`);
        if (args.dias_min) q = q.gte("dias_na_etapa", args.dias_min);
        const { data, error } = await q;
        if (error) return { error: error.message };
        for (const r of (data ?? []) as any[]) {
          c.sources.push({ tipo: "pedido", id: r.futura_pedido_id, label: `${r.nro_pedido ?? r.futura_pedido_id} — ${r.cliente_nome}` });
        }
        return { total: data?.length ?? 0, pedidos: data ?? [] };
      }
      case "pedidos_atrasados": {
        const referencia = args.referencia ?? "data_previsao";
        const dias = args.dias ?? 3;
        let q = c.userClient
          .from("v_pedidos")
          .select("futura_pedido_id, nro_pedido, cliente_nome, etapa, dias_na_etapa, total_pedido, data_previsao, data_emissao")
          .eq("em_andamento", true)
          .limit(Math.min(args.limite ?? 50, 200));
        const hoje = new Date().toISOString().slice(0, 10);
        if (referencia === "data_previsao") {
          q = q.lt("data_previsao", hoje).order("data_previsao", { ascending: true });
        } else {
          q = q.gte("dias_na_etapa", dias).order("dias_na_etapa", { ascending: false });
        }
        const { data, error } = await q;
        if (error) return { error: error.message };
        for (const r of (data ?? []) as any[]) {
          c.sources.push({ tipo: "pedido", id: r.futura_pedido_id, label: `${r.nro_pedido ?? r.futura_pedido_id} — ${r.cliente_nome}` });
        }
        return { total: data?.length ?? 0, referencia, pedidos: data ?? [] };
      }
      case "novos_pedidos": {
        const periodo = args.periodo ?? "hoje";
        const d = new Date();
        if (periodo === "7d") d.setDate(d.getDate() - 7);
        else if (periodo === "30d") d.setDate(d.getDate() - 30);
        const from = d.toISOString().slice(0, 10);
        const { data, error } = await c.userClient
          .from("v_pedidos")
          .select("futura_pedido_id, nro_pedido, cliente_nome, etapa, total_pedido, data_emissao, vendedor_nome")
          .gte("data_emissao", from)
          .order("data_emissao", { ascending: false })
          .limit(Math.min(args.limite ?? 100, 300));
        if (error) return { error: error.message };
        return { periodo, from, total: data?.length ?? 0, pedidos: data ?? [] };
      }
      case "vendas_por_cliente": {
        const { from, to } = { from: args.date_from, to: args.date_to, ...defaultRange(c.scope) };
        const { data, error } = await c.userClient
          .from("v_pedidos")
          .select("cliente_futura_id, cliente_nome, total_pedido")
          .gte("data_emissao", from)
          .lte("data_emissao", to)
          .limit(10000);
        if (error) return { error: error.message };
        const map = new Map<string, { cliente: string; total: number; count: number }>();
        for (const r of (data ?? []) as any[]) {
          const k = `${r.cliente_futura_id ?? r.cliente_nome}`;
          const cur = map.get(k) ?? { cliente: r.cliente_nome ?? "?", total: 0, count: 0 };
          cur.total += Number(r.total_pedido || 0);
          cur.count += 1;
          map.set(k, cur);
        }
        const list = Array.from(map.values())
          .map((x) => ({ ...x, total: Number(x.total.toFixed(2)), ticket_medio: Number((x.total / x.count).toFixed(2)) }))
          .sort((a, b) => b.total - a.total)
          .slice(0, args.top_n ?? 10);
        return { periodo: { from, to }, ranking: list };
      }
      case "faturamento_periodo": {
        const { from, to } = { from: args.date_from, to: args.date_to, ...defaultRange(c.scope) };
        const group_by = args.group_by ?? "dia";
        const { data, error } = await c.userClient
          .from("v_pedidos")
          .select("data_emissao, cliente_nome, vendedor_nome, etapa, total_pedido")
          .gte("data_emissao", from)
          .lte("data_emissao", to)
          .limit(10000);
        if (error) return { error: error.message };
        const rows = (data ?? []) as any[];
        const key = (r: any) => {
          if (group_by === "cliente") return r.cliente_nome ?? "?";
          if (group_by === "vendedor") return r.vendedor_nome ?? "?";
          if (group_by === "etapa") return r.etapa ?? "?";
          if (group_by === "mes") return String(r.data_emissao ?? "").slice(0, 7);
          if (group_by === "semana") {
            const dt = new Date(r.data_emissao + "T00:00:00");
            const onejan = new Date(dt.getFullYear(), 0, 1);
            const w = Math.ceil(((dt.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
            return `${dt.getFullYear()}-S${String(w).padStart(2, "0")}`;
          }
          return r.data_emissao ?? "?";
        };
        const map = new Map<string, { grupo: string; total: number; pedidos: number }>();
        for (const r of rows) {
          const k = key(r);
          const cur = map.get(k) ?? { grupo: k, total: 0, pedidos: 0 };
          cur.total += Number(r.total_pedido || 0);
          cur.pedidos += 1;
          map.set(k, cur);
        }
        const list = Array.from(map.values())
          .map((x) => ({ ...x, total: Number(x.total.toFixed(2)) }))
          .sort((a, b) => a.grupo.localeCompare(b.grupo));
        return {
          periodo: { from, to },
          group_by,
          series: list,
          total_geral: Number(rows.reduce((s, r) => s + Number(r.total_pedido || 0), 0).toFixed(2)),
          pedidos_total: rows.length,
        };
      }
      case "estatisticas_comerciais": {
        const { from, to } = { from: args.date_from, to: args.date_to, ...defaultRange(c.scope) };
        const { data, error } = await c.userClient
          .from("v_pedidos")
          .select("etapa, dias_na_etapa, urgente, em_andamento, data_previsao, total_pedido")
          .gte("data_emissao", from)
          .lte("data_emissao", to)
          .limit(10000);
        if (error) return { error: error.message };
        const rows = (data ?? []) as any[];
        const etapaMap = new Map<string, { etapa: string; pedidos: number; total: number; dias_medio: number; _dias_sum: number; _dias_n: number }>();
        for (const r of rows) {
          const k = r.etapa ?? "?";
          const cur = etapaMap.get(k) ?? { etapa: k, pedidos: 0, total: 0, dias_medio: 0, _dias_sum: 0, _dias_n: 0 };
          cur.pedidos += 1;
          cur.total += Number(r.total_pedido || 0);
          if (typeof r.dias_na_etapa === "number") {
            cur._dias_sum += r.dias_na_etapa;
            cur._dias_n += 1;
          }
          etapaMap.set(k, cur);
        }
        const por_etapa = Array.from(etapaMap.values()).map((x) => ({
          etapa: x.etapa,
          pedidos: x.pedidos,
          total: Number(x.total.toFixed(2)),
          dias_medio: x._dias_n ? Number((x._dias_sum / x._dias_n).toFixed(2)) : null,
        }));
        const urgentes = rows.filter((r) => r.urgente).length;
        const em_andamento = rows.filter((r) => r.em_andamento).length;
        const hoje = new Date().toISOString().slice(0, 10);
        const atrasados = rows.filter((r) => r.em_andamento && r.data_previsao && r.data_previsao < hoje).length;
        return {
          periodo: { from, to },
          total: rows.length,
          urgentes,
          em_andamento,
          atrasados,
          pct_atraso: em_andamento ? Number(((atrasados / em_andamento) * 100).toFixed(1)) : 0,
          por_etapa,
        };
      }
      case "detalhar_pedido": {
        let q = c.userClient.from("v_pedidos").select("*").limit(1);
        if (args.futura_pedido_id) q = q.eq("futura_pedido_id", args.futura_pedido_id);
        else if (args.nro_pedido) q = q.eq("nro_pedido", String(args.nro_pedido));
        else return { error: "informe nro_pedido ou futura_pedido_id" };
        const { data, error } = await q.maybeSingle();
        if (error) return { error: error.message };
        if (!data) return { error: "Pedido não encontrado ou sem acesso." };
        c.sources.push({ tipo: "pedido", id: data.futura_pedido_id, label: `${data.nro_pedido ?? data.futura_pedido_id} — ${data.cliente_nome}` });
        return { pedido: data };
      }
      default:
        return { error: `tool desconhecida: ${name}` };
    }
  } catch (e: any) {
    return { error: e?.message ?? "erro na tool" };
  }
}

function escolherModelo(msg: string): string {
  const t = msg.toLowerCase();
  const heavy = ["relatório", "relatorio", "análise", "analise", "estratégia", "estrategia", "plano de ação", "recomenda", "projeta"];
  if (heavy.some((k) => t.includes(k))) return "openai/gpt-5.5-pro";
  return "openai/gpt-5.5";
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 30, rateLimitPrefix: "pedidos-copilot" },
  async (req, ctx) => {
    const corsHeaders = getCorsHeaders(req);
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { user_message, scope } = parsed.data;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const scopeHint = scope
      ? `\n\nCONTEXTO DA TELA (use para preencher filtros por padrão):\n- Período em foco: ${scope.date_from ?? "?"} → ${scope.date_to ?? "?"}${scope.etapa ? `\n- Etapa em foco: ${scope.etapa}` : ""}`
      : "";
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT + scopeHint },
      { role: "user", content: user_message },
    ];

    const sources: Src[] = [];
    const toolCtx: ToolCtx = { userClient, sources, scope };
    let model = escolherModelo(user_message);
    let iterations = 0;
    let finalAssistant = "";
    while (iterations < 5) {
      iterations++;
      const result = await callAIGateway({
        messages, model, tools: TOOLS, tool_choice: "auto", timeoutMs: 55_000,
      });
      if (result.kind !== "ok") return aiGatewayErrorResponse(result, corsHeaders);
      model = result.modelUsed;
      const msg = result.data.choices?.[0]?.message;
      if (!msg) break;
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
        for (const tc of msg.tool_calls) {
          let args: any = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* noop */ }
          const toolRes = await execTool(tc.function.name, args, toolCtx);
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(toolRes).slice(0, 60000),
          });
        }
        continue;
      }
      finalAssistant = msg.content ?? "";
      break;
    }
    if (!finalAssistant) {
      finalAssistant = "Não consegui finalizar a resposta. Tente reformular a pergunta.";
    }

    const uniqueSources = Array.from(new Map(sources.map((s) => [`${s.tipo}:${s.id}`, s])).values()).slice(0, 20);
    return new Response(
      JSON.stringify({ reply: finalAssistant, sources: uniqueSources, model }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  },
));
