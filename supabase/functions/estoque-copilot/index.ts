// estoque-copilot — Especialista em Estoque Unificado (read-only)
// Conversational agent ligado à página "Estoque Unificado — 3 Níveis".
// Threads persistentes por usuário com retenção de 30 dias (salvo se salvo=true).
// Tools de leitura sobre vw_estoque_unificado, vw_estoque_unificado_skus,
// vw_drift_erp_unificado e vw_bom_path. Sem mutações.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const Filtros = z.object({
  empresaIds: z.array(z.number()).default([]),
  marcas: z.array(z.string()).default([]),
  linhas: z.array(z.string()).default([]),
  busca: z.string().default(""),
  somenteComSaldo: z.boolean().default(true),
  consolidar: z.boolean().default(false),
  modo: z.enum(["fisico", "cx", "bx", "un"]).default("fisico"),
}).strict();

const Body = z.object({
  thread_id: z.string().uuid().optional(),
  user_message: z.string().min(1).max(8000),
  filtros: Filtros.default({} as any),
  kpis_snapshot: z.record(z.any()).optional(),
}).strict();

const SYSTEM_PROMPT = `Você é o Copiloto de Estoque, um especialista sênior em estoque multi-empresa da Huggs.

CONTEXTO DA TELA QUE O USUÁRIO VÊ:
- Página: "Estoque Unificado — 3 Níveis".
- Cada produto-raiz tem três níveis: CX (caixa master) → BX (box/display) → UN (unidade).
- "Total em UN" é a soma matemática considerando o fator_un_acumulado de cada SKU.
- "Disponível" = Total em UN − Bloqueado − Pendente.
- "Bloqueado" inclui avaria, quarentena e endereço travado.
- "Pendente" é saldo comprometido em pedidos abertos (oms_pedidos).
- "Equivalente em CX" reconta o disponível em caixas master usando fator_cx_para_un.
- Filtros que podem estar ativos: empresa(s), marca(s), linha(s), busca textual,
  somenteComSaldo, modo de exibição (físico/CX/BX/UN), consolidar empresas.

REGRAS:
- Responda em português do Brasil, em markdown enxuto, com tabelas/listas quando ajudar.
- SEMPRE respeite os filtros ativos da tela ao analisar — eles vêm no contexto.
- Para qualquer dado numérico, use uma tool. NUNCA invente saldos, SKUs ou empresas.
- Se uma tool voltar vazia, diga isso de forma clara em vez de inventar.
- Você é READ-ONLY. Não propõe mutações, não move saldo, não cria pedido. Pode sugerir
  ações operacionais ao usuário (ex.: "candidato a transferência"), deixando claro que
  é apenas recomendação.
- Quando o usuário perguntar "o que eu estou vendo?", use kpis_snapshot do contexto
  e os filtros ativos para resumir em 5 linhas + 3 pontos de atenção.
- Para drill-down de composição (ex.: "por que SKU X aparece dentro da CX Y?"), use
  detalhar_sku_breakdown e composicao_bom.
- Para excedente / risco de ruptura, use top_produtos com a métrica adequada.
- Para divergência ERP vs. níveis calculados, use drift_erp.

ESCOPO PROIBIDO: não responda sobre projetos, finanças, marketing, RH ou qualquer
tema fora de estoque. Recuse cordialmente.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "kpis_estoque",
      description: "Totais agregados respeitando os filtros ativos: CX, BX, UN físicas, total em UN, bloqueado, disponível, pendente, equivalente em CX, número de produtos-raiz.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_top_produtos",
      description: "Top-N produtos-raiz por uma métrica (respeitando filtros). Use 'metrica' para escolher o critério.",
      parameters: {
        type: "object",
        properties: {
          metrica: {
            type: "string",
            enum: [
              "saldo_total_em_unidades",
              "disponivel_total_em_unidades",
              "bloqueado_total_em_unidades",
              "pendente_total_em_unidades",
              "saldo_em_caixas",
              "custo_total",
            ],
            default: "saldo_total_em_unidades",
          },
          ordem: { type: "string", enum: ["desc", "asc"], default: "desc" },
          limite: { type: "integer", minimum: 1, maximum: 50, default: 10 },
          apenas_disponivel_zerado: { type: "boolean", default: false, description: "Filtra produtos com Disponível = 0 (útil para análise de ruptura)." },
          risco_pendencia: { type: "boolean", default: false, description: "Se true, ordena por razão pendente/disponivel decrescente." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detalhar_sku_breakdown",
      description: "Para um produto-raiz, retorna seus SKUs (CX, BX, UN) com saldos, fator_un_acumulado, contribuição em UN, e o pai_cod na árvore BOM. Use quando o usuário pedir 'detalhar', 'composição', ou 'por que X aparece em Y'.",
      parameters: {
        type: "object",
        properties: {
          produto_raiz: { type: "integer" },
          empresa: { type: "integer", description: "Opcional. Sem isso, agrega todas as empresas dos filtros." },
        },
        required: ["produto_raiz"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "comparar_empresas",
      description: "Matriz empresa × saldo (em UN, CX ou Disponível) para um ou mais produtos-raiz. Mostra onde o estoque está concentrado.",
      parameters: {
        type: "object",
        properties: {
          produtos_raiz: { type: "array", items: { type: "integer" }, minItems: 1, maxItems: 20 },
          metrica: { type: "string", enum: ["saldo_total_em_unidades", "disponivel_total_em_unidades", "saldo_em_caixas"], default: "disponivel_total_em_unidades" },
        },
        required: ["produtos_raiz"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "drift_erp",
      description: "Top divergências entre o saldo interno calculado pelos níveis (CX*fator + BX*fator + UN) e o saldo bruto do ERP. Útil para diagnosticar quando recalcular níveis.",
      parameters: {
        type: "object",
        properties: { limite: { type: "integer", minimum: 1, maximum: 50, default: 15 } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "composicao_bom",
      description: "Árvore BOM (bom_edges) de um produto-raiz: pai→filho com quantidade e profundidade. Responde 'do que essa caixa é feita'.",
      parameters: {
        type: "object",
        properties: {
          raiz_cod: { type: "integer" },
          empresa: { type: "integer" },
        },
        required: ["raiz_cod", "empresa"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_produto_raiz",
      description: "Busca produtos-raiz por texto no nome ou código. Use quando o usuário citar um produto por nome para descobrir o cod_produto antes de drill-down.",
      parameters: {
        type: "object",
        properties: {
          texto: { type: "string", minLength: 2 },
          limite: { type: "integer", minimum: 1, maximum: 30, default: 10 },
        },
        required: ["texto"],
        additionalProperties: false,
      },
    },
  },
];

type Filtros = z.infer<typeof Filtros>;

interface ToolCtx {
  admin: ReturnType<typeof createClient>;
  filtros: Filtros;
  // hidratação de nomes
  nomes: Map<number, string>;
  marcasPorCod: Map<number, string>;
  linhasPorCod: Map<number, string>;
  filiais: Map<number, string>;
}

function clampLimit(n: any, def = 10, max = 50) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return def;
  return Math.min(Math.floor(v), max);
}

async function hydrateNames(admin: ReturnType<typeof createClient>, codigos: number[], empresas: number[]) {
  const nomes = new Map<number, string>();
  const marcas = new Map<number, string>();
  const linhas = new Map<number, string>();
  const filiais = new Map<number, string>();
  if (codigos.length) {
    const { data: prods } = await admin
      .from("erp_estoque_distribuidora")
      .select("cod_produto,nome_prod,nome_linha")
      .in("cod_produto", codigos)
      .range(0, 9999);
    (prods ?? []).forEach((p: any) => {
      if (p?.cod_produto != null && p.nome_prod && !nomes.has(p.cod_produto)) nomes.set(p.cod_produto, p.nome_prod);
      if (p?.cod_produto != null && p.nome_linha && !linhas.has(p.cod_produto)) linhas.set(p.cod_produto, p.nome_linha);
    });
    const { data: rrp } = await admin
      .from("rr_produtos")
      .select("sku,marca")
      .in("sku" as any, codigos as any)
      .range(0, 9999);
    (rrp ?? []).forEach((p: any) => {
      const c = Number(p?.sku);
      if (Number.isFinite(c) && p.marca && !marcas.has(c)) marcas.set(c, String(p.marca));
    });
  }
  if (empresas.length) {
    const { data: dim } = await admin.from("dim_empresa").select("id_empresa,nome_empresa").in("id_empresa", empresas);
    (dim ?? []).forEach((e: any) => {
      if (e?.id_empresa != null) filiais.set(Number(e.id_empresa), e.nome_empresa ?? `Empresa ${e.id_empresa}`);
    });
  }
  return { nomes, marcas, linhas, filiais };
}

async function fetchFilteredRows(admin: ReturnType<typeof createClient>, filtros: Filtros) {
  let q = admin.from("vw_estoque_unificado" as any).select("*");
  if (filtros.empresaIds.length) q = q.in("empresa", filtros.empresaIds);
  if (filtros.somenteComSaldo) q = q.gt("saldo_total_em_unidades", 0);
  q = q.range(0, 9999);
  const { data, error } = await q;
  if (error) throw error;
  let rows = (data ?? []) as any[];

  // hidrata para aplicar filtros de marca/linha/busca
  const codigos = Array.from(new Set(rows.map((r) => Number(r.produto_raiz)).filter(Number.isFinite)));
  const empresas = Array.from(new Set(rows.map((r) => Number(r.empresa)).filter(Number.isFinite)));
  const { nomes, marcas, linhas, filiais } = await hydrateNames(admin, codigos, empresas);

  rows = rows.map((r) => ({
    ...r,
    raiz_nome: nomes.get(Number(r.produto_raiz)) ?? null,
    marca: marcas.get(Number(r.produto_raiz)) ?? null,
    linha: linhas.get(Number(r.produto_raiz)) ?? null,
    filial_nome: filiais.get(Number(r.empresa)) ?? `Empresa ${r.empresa}`,
  }));

  if (filtros.busca) {
    const b = filtros.busca.toLowerCase();
    rows = rows.filter((r) => String(r.produto_raiz).includes(b) || (r.raiz_nome ?? "").toLowerCase().includes(b));
  }
  if (filtros.marcas.length) {
    const set = new Set(filtros.marcas.map((m) => m.toLowerCase()));
    rows = rows.filter((r) => r.marca && set.has(String(r.marca).toLowerCase()));
  }
  if (filtros.linhas.length) {
    const set = new Set(filtros.linhas.map((m) => m.toLowerCase()));
    rows = rows.filter((r) => r.linha && set.has(String(r.linha).toLowerCase()));
  }
  return { rows, nomes, marcas, linhas, filiais };
}

function consolidarPorRaiz(rows: any[]) {
  const map = new Map<number, any>();
  for (const r of rows) {
    const k = Number(r.produto_raiz);
    if (!Number.isFinite(k)) continue;
    const cur = map.get(k);
    if (!cur) {
      map.set(k, { ...r, filiais: [{ empresa: r.empresa, nome: r.filial_nome }] });
    } else {
      cur.saldo_em_caixas = (cur.saldo_em_caixas ?? 0) + (r.saldo_em_caixas ?? 0);
      cur.saldo_em_displays = (cur.saldo_em_displays ?? 0) + (r.saldo_em_displays ?? 0);
      cur.saldo_em_unidades = (cur.saldo_em_unidades ?? 0) + (r.saldo_em_unidades ?? 0);
      cur.saldo_total_em_unidades = (cur.saldo_total_em_unidades ?? 0) + (r.saldo_total_em_unidades ?? 0);
      cur.bloqueado_total_em_unidades = (cur.bloqueado_total_em_unidades ?? 0) + (r.bloqueado_total_em_unidades ?? 0);
      cur.disponivel_total_em_unidades = (cur.disponivel_total_em_unidades ?? 0) + (r.disponivel_total_em_unidades ?? 0);
      cur.pendente_total_em_unidades = (cur.pendente_total_em_unidades ?? 0) + (r.pendente_total_em_unidades ?? 0);
      cur.custo_total = (cur.custo_total ?? 0) + (r.custo_total ?? 0);
      cur.filiais.push({ empresa: r.empresa, nome: r.filial_nome });
    }
  }
  return Array.from(map.values());
}

async function execTool(name: string, args: any, ctx: ToolCtx): Promise<any> {
  try {
    if (name === "kpis_estoque") {
      const { rows } = await fetchFilteredRows(ctx.admin, ctx.filtros);
      const cons = consolidarPorRaiz(rows);
      const agg = cons.reduce(
        (acc, r) => {
          acc.cx += Number(r.saldo_em_caixas ?? 0);
          acc.bx += Number(r.saldo_em_displays ?? 0);
          acc.un += Number(r.saldo_em_unidades ?? 0);
          acc.total_un += Number(r.saldo_total_em_unidades ?? 0);
          acc.bloqueado += Number(r.bloqueado_total_em_unidades ?? 0);
          acc.disponivel += Number(r.disponivel_total_em_unidades ?? 0);
          acc.pendente += Number(r.pendente_total_em_unidades ?? 0);
          const fcx = Number(r.fator_cx_para_un ?? 0);
          if (fcx > 0) acc.equiv_cx += Number(r.disponivel_total_em_unidades ?? 0) / fcx;
          return acc;
        },
        { cx: 0, bx: 0, un: 0, total_un: 0, bloqueado: 0, disponivel: 0, pendente: 0, equiv_cx: 0 },
      );
      return {
        produtos_raiz: cons.length,
        empresas: new Set(rows.map((r) => r.empresa)).size,
        ...Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, Math.round(Number(v) * 100) / 100])),
      };
    }

    if (name === "listar_top_produtos") {
      const limite = clampLimit(args.limite, 10, 50);
      const metrica = String(args.metrica ?? "saldo_total_em_unidades");
      const { rows } = await fetchFilteredRows(ctx.admin, ctx.filtros);
      let cons = consolidarPorRaiz(rows);
      if (args.apenas_disponivel_zerado) cons = cons.filter((r) => Number(r.disponivel_total_em_unidades ?? 0) <= 0);
      const ordemDesc = String(args.ordem ?? "desc") !== "asc";
      cons.sort((a, b) => {
        if (args.risco_pendencia) {
          const ra = Number(a.disponivel_total_em_unidades ?? 0) > 0
            ? Number(a.pendente_total_em_unidades ?? 0) / Number(a.disponivel_total_em_unidades)
            : Number(a.pendente_total_em_unidades ?? 0) > 0 ? Number.POSITIVE_INFINITY : 0;
          const rb = Number(b.disponivel_total_em_unidades ?? 0) > 0
            ? Number(b.pendente_total_em_unidades ?? 0) / Number(b.disponivel_total_em_unidades)
            : Number(b.pendente_total_em_unidades ?? 0) > 0 ? Number.POSITIVE_INFINITY : 0;
          return ordemDesc ? rb - ra : ra - rb;
        }
        const va = Number((a as any)[metrica] ?? 0);
        const vb = Number((b as any)[metrica] ?? 0);
        return ordemDesc ? vb - va : va - vb;
      });
      const out = cons.slice(0, limite).map((r) => ({
        produto_raiz: r.produto_raiz,
        nome: r.raiz_nome,
        marca: r.marca,
        linha: r.linha,
        saldo_em_caixas: r.saldo_em_caixas,
        saldo_total_em_unidades: r.saldo_total_em_unidades,
        disponivel_total_em_unidades: r.disponivel_total_em_unidades,
        bloqueado_total_em_unidades: r.bloqueado_total_em_unidades,
        pendente_total_em_unidades: r.pendente_total_em_unidades,
        custo_total: r.custo_total,
        empresas_com_saldo: r.filiais?.length ?? 1,
      }));
      return { metrica, total_considerados: cons.length, top: out };
    }

    if (name === "detalhar_sku_breakdown") {
      const raiz = Number(args.produto_raiz);
      let q = ctx.admin.from("vw_estoque_unificado_skus" as any).select("*").eq("produto_raiz", raiz);
      if (args.empresa != null) q = q.eq("empresa", Number(args.empresa));
      else if (ctx.filtros.empresaIds.length) q = q.in("empresa", ctx.filtros.empresaIds);
      const { data, error } = await q.range(0, 2000);
      if (error) return { error: error.message };
      const rows = data ?? [];
      if (!rows.length) return { vazio: true, mensagem: "Nenhum SKU encontrado para esse produto-raiz com os filtros aplicados." };
      const skus = (rows as any[]).map((r) => ({
        empresa: r.empresa,
        cod_produto: r.cod_produto,
        nome: r.nome_prod,
        nivel: r.nivel,
        pai_cod: r.pai_cod,
        fator_pai_para_filho: r.fator_pai_para_filho,
        fator_un_acumulado: r.fator_un_acumulado,
        saldo: r.saldo,
        disponivel: r.disponivel,
        bloqueado: r.bloqueado,
        pendente: r.pendente,
        contribuicao_un: r.contribuicao_un,
      }));
      return { produto_raiz: raiz, total_skus: skus.length, skus: skus.slice(0, 200) };
    }

    if (name === "comparar_empresas") {
      const codes = (args.produtos_raiz as any[]).map(Number).filter(Number.isFinite).slice(0, 20);
      const metrica = String(args.metrica ?? "disponivel_total_em_unidades");
      let q = ctx.admin.from("vw_estoque_unificado" as any).select("*").in("produto_raiz", codes);
      if (ctx.filtros.empresaIds.length) q = q.in("empresa", ctx.filtros.empresaIds);
      const { data, error } = await q.range(0, 5000);
      if (error) return { error: error.message };
      const empresasIds = Array.from(new Set((data ?? []).map((r: any) => Number(r.empresa)).filter(Number.isFinite)));
      const { nomes, filiais } = await hydrateNames(ctx.admin, codes, empresasIds);
      const matriz: Record<string, any> = {};
      for (const r of data ?? []) {
        const cod = Number((r as any).produto_raiz);
        const emp = Number((r as any).empresa);
        const key = `${cod}`;
        if (!matriz[key]) matriz[key] = { produto_raiz: cod, nome: nomes.get(cod) ?? null, por_empresa: {} };
        matriz[key].por_empresa[filiais.get(emp) ?? `Empresa ${emp}`] = Number((r as any)[metrica] ?? 0);
      }
      return { metrica, linhas: Object.values(matriz) };
    }

    if (name === "drift_erp") {
      const limite = clampLimit(args.limite, 15, 50);
      let q = ctx.admin.from("vw_drift_erp_unificado" as any).select("*");
      if (ctx.filtros.empresaIds.length) q = q.in("empresa", ctx.filtros.empresaIds);
      const { data, error } = await q
        .order("drift_pct" as any, { ascending: false, nullsFirst: false } as any)
        .range(0, limite - 1);
      if (error) return { error: error.message };
      const codigos = Array.from(new Set((data ?? []).map((r: any) => Number(r.raiz_cod ?? r.produto_raiz)).filter(Number.isFinite)));
      const empresas = Array.from(new Set((data ?? []).map((r: any) => Number(r.empresa)).filter(Number.isFinite)));
      const { nomes, filiais } = await hydrateNames(ctx.admin, codigos, empresas);
      return {
        top_divergencias: (data ?? []).map((r: any) => ({
          empresa: r.empresa,
          empresa_nome: filiais.get(Number(r.empresa)) ?? null,
          produto_raiz: r.raiz_cod ?? r.produto_raiz,
          nome: nomes.get(Number(r.raiz_cod ?? r.produto_raiz)) ?? null,
          saldo_interno: r.saldo_interno,
          saldo_erp: r.saldo_erp,
          drift: r.drift,
          drift_pct: r.drift_pct,
        })),
      };
    }

    if (name === "composicao_bom") {
      const { data, error } = await ctx.admin
        .from("vw_bom_path" as any)
        .select("*")
        .eq("empresa", Number(args.empresa))
        .eq("raiz_cod", Number(args.raiz_cod))
        .order("profundidade", { ascending: true })
        .range(0, 500);
      if (error) return { error: error.message };
      return { arvore: data ?? [] };
    }

    if (name === "buscar_produto_raiz") {
      const limite = clampLimit(args.limite, 10, 30);
      const texto = String(args.texto ?? "").trim();
      const ehNumero = /^\d+$/.test(texto);
      let q = ctx.admin
        .from("erp_estoque_distribuidora")
        .select("cod_produto,nome_prod,nome_linha")
        .limit(limite * 3);
      if (ehNumero) q = q.eq("cod_produto", Number(texto));
      else q = q.ilike("nome_prod", `%${texto}%`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const dedup = new Map<number, any>();
      for (const r of data ?? []) {
        const cod = Number((r as any).cod_produto);
        if (!Number.isFinite(cod) || dedup.has(cod)) continue;
        dedup.set(cod, { cod_produto: cod, nome: (r as any).nome_prod, linha: (r as any).nome_linha });
      }
      return { resultados: Array.from(dedup.values()).slice(0, limite) };
    }

    return { error: `tool desconhecida: ${name}` };
  } catch (e: any) {
    return { error: e?.message ?? "erro interno na tool" };
  }
}

function describeFiltros(f: Filtros, kpis?: Record<string, any>): string {
  const parts: string[] = [];
  parts.push(`empresaIds: ${f.empresaIds.length ? f.empresaIds.join(",") : "todas"}`);
  if (f.marcas.length) parts.push(`marcas: ${f.marcas.join(", ")}`);
  if (f.linhas.length) parts.push(`linhas: ${f.linhas.join(", ")}`);
  if (f.busca) parts.push(`busca: "${f.busca}"`);
  parts.push(`modo: ${f.modo}`);
  parts.push(`somenteComSaldo: ${f.somenteComSaldo}`);
  parts.push(`consolidar: ${f.consolidar}`);
  let s = `FILTROS ATIVOS DA TELA → ${parts.join(" | ")}`;
  if (kpis && Object.keys(kpis).length) {
    s += `\n\nKPIs JÁ EXIBIDOS PARA O USUÁRIO:\n${JSON.stringify(kpis)}`;
  }
  return s;
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 30, rateLimitPrefix: "estoque-copilot" },
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
    const { thread_id, user_message, filtros, kpis_snapshot } = parsed.data;
    const userId = ctx.userId!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Garante thread
    let threadId = thread_id;
    if (!threadId) {
      const { data: t, error: tErr } = await admin.from("estoque_copilot_threads")
        .insert({
          user_id: userId,
          titulo: user_message.slice(0, 60),
          filtros_snapshot: filtros,
        })
        .select("id").single();
      if (tErr) {
        return new Response(JSON.stringify({ error: tErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      threadId = t.id;
    } else {
      const { data: th } = await admin.from("estoque_copilot_threads")
        .select("user_id").eq("id", threadId).maybeSingle();
      if (!th || (th as any).user_id !== userId) {
        return new Response(JSON.stringify({ error: "Thread inválida." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Histórico curto
    const { data: hist } = await admin.from("estoque_copilot_mensagens")
      .select("role, content, tool_calls").eq("thread_id", threadId)
      .order("created_at", { ascending: true }).limit(20);

    // Persiste a mensagem do usuário
    await admin.from("estoque_copilot_mensagens").insert({
      thread_id: threadId, role: "user", content: user_message,
    });

    const ctxFiltros = describeFiltros(filtros, kpis_snapshot);
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: ctxFiltros },
      ...((hist ?? []).map((m: any) => ({ role: m.role, content: m.content }))),
      { role: "user", content: user_message },
    ];

    const toolCtx: ToolCtx = {
      admin: admin as any,
      filtros,
      nomes: new Map(),
      marcasPorCod: new Map(),
      linhasPorCod: new Map(),
      filiais: new Map(),
    };

    let model = "openai/gpt-5.5";
    let finalAssistant = "";
    let iterations = 0;
    while (iterations < 5) {
      iterations++;
      const result = await callAIGateway({
        messages,
        model,
        tools: TOOLS,
        tool_choice: "auto",
        timeoutMs: 55_000,
      });
      if (result.kind !== "ok") return aiGatewayErrorResponse(result, corsHeaders);
      model = result.modelUsed;
      const choice = result.data.choices?.[0];
      const msg = choice?.message;
      if (!msg) break;
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
        for (const tc of msg.tool_calls) {
          let args: any = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
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
    if (!finalAssistant && iterations >= 5) {
      finalAssistant = "Não consegui finalizar a resposta após várias iterações. Tente reformular sua pergunta de forma mais específica.";
    }

    await admin.from("estoque_copilot_mensagens").insert({
      thread_id: threadId,
      role: "assistant",
      content: finalAssistant || "Não consegui responder com as informações disponíveis.",
      model,
    });
    await admin.from("estoque_copilot_threads")
      .update({ updated_at: new Date().toISOString(), filtros_snapshot: filtros })
      .eq("id", threadId);

    return new Response(JSON.stringify({
      thread_id: threadId,
      reply: finalAssistant,
      model,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  },
));
