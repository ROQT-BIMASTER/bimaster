import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ────────── Tools definitions for Sofia ──────────
const sofiaTools = [
  {
    type: "function",
    function: {
      name: "buscar_contas_vencidas",
      description: "Busca contas a pagar vencidas com detalhes de fornecedor, valor e dias de atraso.",
      parameters: {
        type: "object",
        properties: {
          limite: { type: "number", description: "Quantidade máxima de resultados (padrão 50)" },
          dias_atraso_min: { type: "number", description: "Filtrar por mínimo de dias de atraso" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_contas_por_fornecedor",
      description: "Busca contas a pagar de um fornecedor específico. Sem limite de data.",
      parameters: {
        type: "object",
        properties: {
          fornecedor_nome: { type: "string", description: "Nome (parcial) do fornecedor" },
        },
        required: ["fornecedor_nome"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resumo_fluxo_caixa",
      description: "Resumo do fluxo de caixa com entradas e saídas. Pode olhar para frente ou para trás.",
      parameters: {
        type: "object",
        properties: {
          dias_futuro: { type: "number", description: "Projeção para quantos dias à frente (padrão 30)" },
          dias_passado: { type: "number", description: "Olhar quantos dias para trás (padrão 0)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analise_aging",
      description: "Análise de aging (envelhecimento) das contas a pagar vencidas por faixa de dias. Sem limite de data.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "top_fornecedores_gastos",
      description: "Lista fornecedores com maiores valores. Pode filtrar por ano ou trazer todo o histórico.",
      parameters: {
        type: "object",
        properties: {
          limite: { type: "number", description: "Quantidade de fornecedores (padrão 10)" },
          ano: { type: "number", description: "Ano para filtrar. Se não informado, traz todo o histórico." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gerar_relatorio_executivo",
      description: "Gera relatório executivo completo com todas as métricas financeiras. Usa todo o histórico disponível.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gerar_dados_grafico",
      description: "Gera dados para gráficos interativos. Use SEMPRE que o usuário pedir gráfico, visualização, chart ou comparativo visual. Tipos: bar, line, pie, area.",
      parameters: {
        type: "object",
        properties: {
          tipo_grafico: { type: "string", enum: ["bar", "line", "pie", "area"], description: "Tipo de gráfico" },
          analise: { type: "string", enum: ["aging", "fornecedores_top", "fluxo_mensal", "categorias", "status_contas", "evolucao_vencidas"], description: "Tipo de análise para o gráfico" },
          limite: { type: "number", description: "Limite de itens (padrão 10)" },
          ano: { type: "number", description: "Ano para filtrar. Sem filtro = todo o histórico." },
        },
        required: ["tipo_grafico", "analise"],
        additionalProperties: false,
      },
    },
  },
];

// ────────── Fetch all records bypassing 1000 limit ──────────
async function fetchAll(sb: any, table: string, select: string, filters?: (q: any) => any) {
  const batchSize = 1000;
  let allData: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = sb.from(table).select(select).range(offset, offset + batchSize - 1);
    if (filters) query = filters(query);
    const { data, error } = await query;
    if (error || !data?.length) { hasMore = false; break; }
    allData = allData.concat(data);
    if (data.length < batchSize) hasMore = false;
    offset += batchSize;
  }
  return allData;
}

// ────────── Tool execution ──────────
async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const sb = getSupabaseAdmin();
  const hoje = new Date();
  const dataHoje = hoje.toISOString().split("T")[0];

  switch (name) {
    case "buscar_contas_vencidas": {
      const limite = (args.limite as number) || 50;
      const diasMin = (args.dias_atraso_min as number) || 0;
      const dataLimite = diasMin > 0
        ? new Date(hoje.getTime() - diasMin * 86400000).toISOString().split("T")[0]
        : dataHoje;

      const { data, error } = await sb
        .from("contas_pagar")
        .select("fornecedor_nome, valor_original, valor_aberto, data_vencimento, status, categoria_nome, numero_documento")
        .lt("data_vencimento", dataLimite)
        .neq("status", "pago")
        .order("data_vencimento", { ascending: true })
        .limit(limite);

      if (error) return `Erro ao buscar: ${error.message}`;
      if (!data?.length) return "Nenhuma conta vencida encontrada.";

      const resultado = data.map((c: any) => {
        const dias = Math.floor((hoje.getTime() - new Date(c.data_vencimento).getTime()) / 86400000);
        return `• ${c.fornecedor_nome || "N/I"}: R$ ${(c.valor_aberto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} — ${dias} dias de atraso (Cat: ${c.categoria_nome || "N/C"})`;
      });

      const total = data.reduce((s: number, c: any) => s + (c.valor_aberto || 0), 0);
      return `**${data.length} contas vencidas** (total: R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}):\n\n${resultado.join("\n")}`;
    }

    case "buscar_contas_por_fornecedor": {
      const nome = args.fornecedor_nome as string;
      const { data, error } = await sb
        .from("contas_pagar")
        .select("fornecedor_nome, valor_original, valor_aberto, data_vencimento, status, categoria_nome")
        .ilike("fornecedor_nome", `%${nome}%`)
        .order("data_vencimento", { ascending: false })
        .limit(50);

      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return `Nenhuma conta encontrada para "${nome}".`;

      const total = data.reduce((s: number, c: any) => s + (c.valor_aberto || 0), 0);
      const pagas = data.filter((c: any) => c.status === "pago").length;
      const vencidas = data.filter((c: any) => c.data_vencimento < dataHoje && c.status !== "pago").length;

      const linhas = data.slice(0, 15).map((c: any) =>
        `• R$ ${(c.valor_aberto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} — Venc: ${c.data_vencimento?.substring(0, 10)} — Status: ${c.status}`
      );

      return `**Fornecedor: ${data[0].fornecedor_nome}**\n${data.length} títulos | ${pagas} pagos | ${vencidas} vencidos | Total aberto: R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n\n${linhas.join("\n")}`;
    }

    case "resumo_fluxo_caixa": {
      const diasFuturo = (args.dias_futuro as number) || 30;
      const diasPassado = (args.dias_passado as number) || 0;
      const dataFim = new Date(hoje.getTime() + diasFuturo * 86400000).toISOString().split("T")[0];
      const dataInicio = diasPassado > 0
        ? new Date(hoje.getTime() - diasPassado * 86400000).toISOString().split("T")[0]
        : dataHoje;

      const { data: saidas } = await sb
        .from("contas_pagar")
        .select("valor_aberto, data_vencimento")
        .gte("data_vencimento", dataInicio)
        .lte("data_vencimento", dataFim)
        .neq("status", "pago");

      const { data: entradas } = await sb
        .from("contas_receber")
        .select("valor_aberto, data_vencimento")
        .gte("data_vencimento", dataInicio)
        .lte("data_vencimento", dataFim)
        .neq("status", "recebido");

      const totalSaidas = (saidas || []).reduce((s: number, c: any) => s + (c.valor_aberto || 0), 0);
      const totalEntradas = (entradas || []).reduce((s: number, c: any) => s + (c.valor_aberto || 0), 0);
      const saldo = totalEntradas - totalSaidas;

      const periodo = diasPassado > 0 ? `De ${dataInicio} a ${dataFim}` : `Próximos ${diasFuturo} dias`;

      return `**Fluxo de Caixa — ${periodo}:**\n\n📥 Entradas previstas: R$ ${totalEntradas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${(entradas || []).length} títulos)\n📤 Saídas previstas: R$ ${totalSaidas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${(saidas || []).length} títulos)\n${saldo >= 0 ? "✅" : "⚠️"} Saldo projetado: R$ ${saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    }

    case "analise_aging": {
      const vencidas = await fetchAll(sb, "contas_pagar", "valor_aberto, data_vencimento", (q: any) =>
        q.lt("data_vencimento", dataHoje).neq("status", "pago")
      );

      const faixas = { ate30: 0, de31a60: 0, de61a90: 0, acima90: 0 };
      const qtd = { ate30: 0, de31a60: 0, de61a90: 0, acima90: 0 };

      vencidas.forEach((c: any) => {
        const dias = Math.floor((hoje.getTime() - new Date(c.data_vencimento).getTime()) / 86400000);
        const val = c.valor_aberto || 0;
        if (dias <= 30) { faixas.ate30 += val; qtd.ate30++; }
        else if (dias <= 60) { faixas.de31a60 += val; qtd.de31a60++; }
        else if (dias <= 90) { faixas.de61a90 += val; qtd.de61a90++; }
        else { faixas.acima90 += val; qtd.acima90++; }
      });

      const total = Object.values(faixas).reduce((a, b) => a + b, 0);
      const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

      return `**Aging de Contas Vencidas (todo o histórico):**\n\n| Faixa | Títulos | Valor | % |\n|---|---|---|---|\n| Até 30 dias | ${qtd.ate30} | R$ ${fmt(faixas.ate30)} | ${total > 0 ? ((faixas.ate30 / total) * 100).toFixed(1) : 0}% |\n| 31-60 dias | ${qtd.de31a60} | R$ ${fmt(faixas.de31a60)} | ${total > 0 ? ((faixas.de31a60 / total) * 100).toFixed(1) : 0}% |\n| 61-90 dias | ${qtd.de61a90} | R$ ${fmt(faixas.de61a90)} | ${total > 0 ? ((faixas.de61a90 / total) * 100).toFixed(1) : 0}% |\n| Acima 90 dias | ${qtd.acima90} | R$ ${fmt(faixas.acima90)} | ${total > 0 ? ((faixas.acima90 / total) * 100).toFixed(1) : 0}% |\n| **Total** | **${vencidas.length}** | **R$ ${fmt(total)}** | **100%** |`;
    }

    case "top_fornecedores_gastos": {
      const limite = (args.limite as number) || 10;
      const ano = args.ano as number | undefined;

      const filters = ano
        ? (q: any) => q.gte("data_vencimento", `${ano}-01-01`).lte("data_vencimento", `${ano}-12-31`)
        : undefined;

      const data = await fetchAll(sb, "contas_pagar", "fornecedor_nome, valor_original, valor_aberto, status", filters);

      if (!data?.length) return "Nenhum dado encontrado.";

      const agrupado: Record<string, { total: number; aberto: number; qtd: number }> = {};
      data.forEach((c: any) => {
        const key = c.fornecedor_nome || "N/I";
        if (!agrupado[key]) agrupado[key] = { total: 0, aberto: 0, qtd: 0 };
        agrupado[key].total += c.valor_original || 0;
        agrupado[key].aberto += c.valor_aberto || 0;
        agrupado[key].qtd++;
      });

      const sorted = Object.entries(agrupado)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, limite);

      const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
      const periodoLabel = ano ? `${ano}` : "Todo o histórico";
      const linhas = sorted.map(([nome, d], i) =>
        `${i + 1}. **${nome}** — R$ ${fmt(d.total)} total (${d.qtd} títulos, R$ ${fmt(d.aberto)} em aberto)`
      );

      return `**Top ${limite} Fornecedores por Volume (${periodoLabel}):**\n\n${linhas.join("\n")}`;
    }

    case "gerar_relatorio_executivo": {
      const [vencidas, pagar, receber] = await Promise.all([
        fetchAll(sb, "contas_pagar", "valor_aberto, data_vencimento, status, fornecedor_nome, categoria_nome", (q: any) =>
          q.lt("data_vencimento", dataHoje).neq("status", "pago")
        ),
        fetchAll(sb, "contas_pagar", "valor_original, valor_aberto, valor_pago, status, data_vencimento"),
        fetchAll(sb, "contas_receber", "valor_original, valor_aberto, status, data_vencimento"),
      ]);

      const totalPagar = pagar.reduce((s: number, c: any) => s + (c.valor_original || 0), 0);
      const totalAbertoPagar = pagar.reduce((s: number, c: any) => s + (c.valor_aberto || 0), 0);
      const totalVencido = vencidas.reduce((s: number, c: any) => s + (c.valor_aberto || 0), 0);
      const totalReceber = receber.reduce((s: number, c: any) => s + (c.valor_original || 0), 0);
      const totalAbertoReceber = receber.reduce((s: number, c: any) => s + (c.valor_aberto || 0), 0);

      const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

      return `# 📊 Relatório Executivo Financeiro — ${new Date().toLocaleDateString("pt-BR")}\n\n## Contas a Pagar (todo o histórico)\n- Total: **R$ ${fmt(totalPagar)}** (${pagar.length} títulos)\n- Em aberto: **R$ ${fmt(totalAbertoPagar)}**\n- Vencidas: **R$ ${fmt(totalVencido)}** (${vencidas.length} títulos)\n\n## Contas a Receber (todo o histórico)\n- Total: **R$ ${fmt(totalReceber)}** (${receber.length} títulos)\n- Em aberto: **R$ ${fmt(totalAbertoReceber)}**\n\n## Saldo Líquido\n- A receber - A pagar (aberto): **R$ ${fmt(totalAbertoReceber - totalAbertoPagar)}**\n\n---\n*Relatório gerado automaticamente pela Sofia IA com dados completos.*`;
    }

    case "gerar_dados_grafico": {
      const tipoGrafico = args.tipo_grafico as string;
      const analise = args.analise as string;
      const limite = (args.limite as number) || 10;
      const ano = args.ano as number | undefined;

      let chartData: any[] = [];
      let chartTitle = "";
      let xKey = "name";
      let yKeys: string[] = ["value"];
      let colors: string[] = ["#3b82f6"];

      switch (analise) {
        case "aging": {
          const vencidas = await fetchAll(sb, "contas_pagar", "valor_aberto, data_vencimento", (q: any) =>
            q.lt("data_vencimento", dataHoje).neq("status", "pago")
          );
          const faixas: Record<string, number> = { "Até 30d": 0, "31-60d": 0, "61-90d": 0, "91-180d": 0, "+180d": 0 };
          vencidas.forEach((c: any) => {
            const dias = Math.floor((hoje.getTime() - new Date(c.data_vencimento).getTime()) / 86400000);
            const val = c.valor_aberto || 0;
            if (dias <= 30) faixas["Até 30d"] += val;
            else if (dias <= 60) faixas["31-60d"] += val;
            else if (dias <= 90) faixas["61-90d"] += val;
            else if (dias <= 180) faixas["91-180d"] += val;
            else faixas["+180d"] += val;
          });
          chartData = Object.entries(faixas).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
          chartTitle = "Aging de Contas Vencidas";
          colors = ["#22c55e", "#eab308", "#f97316", "#ef4444", "#991b1b"];
          break;
        }
        case "fornecedores_top": {
          const filters = ano ? (q: any) => q.gte("data_vencimento", `${ano}-01-01`).lte("data_vencimento", `${ano}-12-31`) : undefined;
          const data = await fetchAll(sb, "contas_pagar", "fornecedor_nome, valor_original", filters);
          const agrupado: Record<string, number> = {};
          data.forEach((c: any) => {
            const key = c.fornecedor_nome || "N/I";
            agrupado[key] = (agrupado[key] || 0) + (c.valor_original || 0);
          });
          chartData = Object.entries(agrupado)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limite)
            .map(([name, value]) => ({ name: name.length > 20 ? name.substring(0, 20) + "…" : name, value: Math.round(value * 100) / 100 }));
          chartTitle = `Top ${limite} Fornecedores${ano ? ` (${ano})` : " (Histórico)"}`;
          colors = ["#6366f1"];
          break;
        }
        case "fluxo_mensal": {
          const pagar = await fetchAll(sb, "contas_pagar", "valor_aberto, data_vencimento, status");
          const receber = await fetchAll(sb, "contas_receber", "valor_aberto, data_vencimento, status");
          const meses: Record<string, { entradas: number; saidas: number }> = {};
          const addToMonth = (arr: any[], key: "entradas" | "saidas") => {
            arr.forEach((c: any) => {
              if (!c.data_vencimento) return;
              const m = c.data_vencimento.substring(0, 7);
              if (!meses[m]) meses[m] = { entradas: 0, saidas: 0 };
              meses[m][key] += c.valor_aberto || 0;
            });
          };
          addToMonth(receber, "entradas");
          addToMonth(pagar, "saidas");
          chartData = Object.entries(meses)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-12)
            .map(([name, d]) => ({
              name,
              entradas: Math.round(d.entradas * 100) / 100,
              saidas: Math.round(d.saidas * 100) / 100,
            }));
          chartTitle = "Fluxo de Caixa Mensal";
          xKey = "name";
          yKeys = ["entradas", "saidas"];
          colors = ["#22c55e", "#ef4444"];
          break;
        }
        case "categorias": {
          const filters = ano ? (q: any) => q.gte("data_vencimento", `${ano}-01-01`).lte("data_vencimento", `${ano}-12-31`) : undefined;
          const data = await fetchAll(sb, "contas_pagar", "categoria_nome, valor_original", filters);
          const agrupado: Record<string, number> = {};
          data.forEach((c: any) => {
            const key = c.categoria_nome || "Sem categoria";
            agrupado[key] = (agrupado[key] || 0) + (c.valor_original || 0);
          });
          chartData = Object.entries(agrupado)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limite)
            .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
          chartTitle = `Gastos por Categoria${ano ? ` (${ano})` : ""}`;
          colors = ["#8b5cf6", "#ec4899", "#06b6d4", "#f59e0b", "#10b981", "#6366f1", "#f97316", "#14b8a6", "#a855f7", "#e11d48"];
          break;
        }
        case "status_contas": {
          const data = await fetchAll(sb, "contas_pagar", "status, valor_aberto");
          const agrupado: Record<string, { valor: number; qtd: number }> = {};
          data.forEach((c: any) => {
            const key = c.status || "N/I";
            if (!agrupado[key]) agrupado[key] = { valor: 0, qtd: 0 };
            agrupado[key].valor += c.valor_aberto || 0;
            agrupado[key].qtd++;
          });
          chartData = Object.entries(agrupado).map(([name, d]) => ({
            name,
            value: Math.round(d.valor * 100) / 100,
            qtd: d.qtd,
          }));
          chartTitle = "Distribuição por Status";
          colors = ["#22c55e", "#eab308", "#ef4444", "#6366f1", "#94a3b8"];
          break;
        }
        case "evolucao_vencidas": {
          const vencidas = await fetchAll(sb, "contas_pagar", "valor_aberto, data_vencimento", (q: any) =>
            q.lt("data_vencimento", dataHoje).neq("status", "pago")
          );
          const meses: Record<string, number> = {};
          vencidas.forEach((c: any) => {
            if (!c.data_vencimento) return;
            const m = c.data_vencimento.substring(0, 7);
            meses[m] = (meses[m] || 0) + (c.valor_aberto || 0);
          });
          chartData = Object.entries(meses)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
          chartTitle = "Evolução de Contas Vencidas por Mês";
          colors = ["#ef4444"];
          break;
        }
      }

      // Return as special chart marker
      const chartPayload = JSON.stringify({
        type: tipoGrafico,
        title: chartTitle,
        data: chartData,
        xKey,
        yKeys,
        colors,
      });

      return `[SOFIA_CHART]${chartPayload}[/SOFIA_CHART]\n\nGráfico "${chartTitle}" gerado com ${chartData.length} pontos de dados.`;
    }

    default:
      return `Ferramenta "${name}" não reconhecida.`;
  }
}

// ────────── Build context summary ──────────
async function buildContextSummary(): Promise<string> {
  const sb = getSupabaseAdmin();
  const hoje = new Date();
  const dataHoje = hoje.toISOString().split("T")[0];

  const [contas, receber] = await Promise.all([
    fetchAll(sb, "contas_pagar", "valor_original, valor_aberto, data_vencimento, status"),
    fetchAll(sb, "contas_receber", "valor_original, valor_aberto, data_vencimento, status"),
  ]);

  const totalContas = contas.length;
  const totalAberto = contas.reduce((s, c: any) => s + (c.valor_aberto || 0), 0);
  const vencidas = contas.filter((c: any) => c.data_vencimento < dataHoje && c.status !== "pago");
  const totalVencido = vencidas.reduce((s, c: any) => s + (c.valor_aberto || 0), 0);
  const totalReceber = receber.reduce((s, c: any) => s + (c.valor_aberto || 0), 0);

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return `Data: ${new Date().toLocaleDateString("pt-BR")}
Contas a Pagar: ${totalContas} títulos no total (todo histórico), ${fmt(totalAberto)} em aberto, ${vencidas.length} vencidas (${fmt(totalVencido)})
Contas a Receber: ${receber.length} títulos, ${fmt(totalReceber)} em aberto
Saldo Líquido (aberto): ${fmt(totalReceber - totalAberto)}
IMPORTANTE: Você tem acesso a TODO o histórico, sem limitação de datas.`;
}

const SYSTEM_PROMPT = `Você é Sofia, uma assistente financeira avançada especialista em contas a pagar e gestão financeira corporativa. Você tem acesso a ferramentas para consultar dados financeiros em tempo real.

## Suas capacidades:
1. **Consultar contas vencidas** com detalhes de fornecedor e dias de atraso
2. **Buscar contas por fornecedor** específico
3. **Analisar fluxo de caixa** com projeções de entradas e saídas
4. **Gerar análise de aging** (envelhecimento de dívidas)
5. **Rankear fornecedores** por volume de gastos
6. **Gerar relatórios executivos** completos
7. **Gerar gráficos interativos** (barras, linhas, pizza, área) com dados reais

## GRÁFICOS - REGRA IMPORTANTE:
- SEMPRE que o usuário pedir gráfico, chart, visualização, comparativo visual ou similar, use a ferramenta "gerar_dados_grafico"
- Escolha o tipo de gráfico mais adequado: bar para comparações, line/area para evolução temporal, pie para distribuição
- Após gerar o gráfico, explique brevemente o que os dados mostram
- O usuário poderá fazer download do gráfico como imagem PNG e dos dados como Excel

## DADOS SEM RESTRIÇÃO:
- Você tem acesso a TODO o histórico de dados, sem limite de datas
- Use filtros de data apenas quando o usuário especificar
- Quando não houver filtro, analise todo o período disponível

## Conhecimento em legislação:
- Lei 14.133/2021: Prazo máximo 30 dias para pagamento
- Código Civil Art. 389, 395, 397: Mora, juros e inadimplemento
- KPIs: DSO, DPO, Working Capital Ratio
- Práticas: ABC, Early Payment Discount (2-3%), Pareto 80/20

## Comportamento:
- Responda em português brasileiro, de forma clara e profissional
- Use as ferramentas SEMPRE que precisar de dados atualizados
- Formate valores em R$ com 2 casas decimais
- Use markdown para estruturar respostas (tabelas, listas, negrito)
- Dê insights proativos e recomendações baseadas nos dados
- Cite legislação quando relevante
- Seja concisa mas completa`;

// ────────── MAIN HANDLER ──────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, history = [], generateAudio = false } = await req.json();

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const contextSummary = await buildContextSummary();

    const messages = [
      { role: "system", content: `${SYSTEM_PROMPT}\n\n## Resumo atual:\n${contextSummary}` },
      ...((history as any[]).slice(-15)),
      { role: "user", content: message },
    ];

    const firstRes = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages,
        tools: sofiaTools,
        temperature: 0.4,
        max_tokens: 3000,
      }),
    });

    if (!firstRes.ok) {
      const t = await firstRes.text();
      console.error("AI error:", firstRes.status, t);
      if (firstRes.status === 429) {
        return new Response(JSON.stringify({ success: false, error: "Muitas solicitações. Aguarde um momento." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (firstRes.status === 402) {
        return new Response(JSON.stringify({ success: false, error: "Créditos de IA esgotados." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI error: ${firstRes.status}`);
    }

    const firstData = await firstRes.json();
    const firstChoice = firstData.choices?.[0]?.message;

    let finalContent = firstChoice?.content || "";
    const toolsUsed: string[] = [];
    const charts: any[] = [];

    // If AI wants to call tools
    if (firstChoice?.tool_calls?.length) {
      const toolResults: any[] = [];

      for (const tc of firstChoice.tool_calls) {
        const toolName = tc.function.name;
        let toolArgs = {};
        try { toolArgs = JSON.parse(tc.function.arguments || "{}"); } catch { /* */ }

        console.log(`[Sofia] Executing tool: ${toolName}`, toolArgs);
        toolsUsed.push(toolName);

        const result = await executeTool(toolName, toolArgs);

        // Extract chart data from tool result
        const chartMatch = result.match(/\[SOFIA_CHART\](.*?)\[\/SOFIA_CHART\]/s);
        if (chartMatch) {
          try { charts.push(JSON.parse(chartMatch[1])); } catch { /* */ }
        }

        toolResults.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }

      const secondMessages = [
        ...messages,
        firstChoice,
        ...toolResults,
      ];

      const secondRes = await fetch(AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: secondMessages,
          temperature: 0.4,
          max_tokens: 3000,
        }),
      });

      if (secondRes.ok) {
        const secondData = await secondRes.json();
        finalContent = secondData.choices?.[0]?.message?.content || finalContent;
      }
    }

    if (!finalContent) {
      finalContent = "Desculpe, não consegui processar sua solicitação. Tente reformular a pergunta.";
    }

    // Generate audio if requested
    let audioBase64: string | null = null;
    if (generateAudio) {
      const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
      if (ELEVENLABS_API_KEY) {
        try {
          const textForTTS = finalContent
            .replace(/[#*|_`\[\]]/g, "")
            .replace(/\n{2,}/g, ". ")
            .replace(/\n/g, " ")
            .substring(0, 800);

          const ttsResponse = await fetch(
            "https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL?output_format=mp3_44100_128",
            {
              method: "POST",
              headers: {
                "xi-api-key": ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                text: textForTTS,
                model_id: "eleven_multilingual_v2",
                voice_settings: {
                  stability: 0.5,
                  similarity_boost: 0.75,
                  style: 0.3,
                  use_speaker_boost: true,
                  speed: 1.05,
                },
              }),
            }
          );

          if (ttsResponse.ok) {
            const { encode: base64Encode } = await import("https://deno.land/std@0.168.0/encoding/base64.ts");
            const audioBuffer = await ttsResponse.arrayBuffer();
            audioBase64 = base64Encode(audioBuffer);
          } else {
            console.error("ElevenLabs TTS error:", ttsResponse.status);
          }
        } catch (ttsError) {
          console.error("TTS error:", ttsError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: finalContent,
        audioBase64,
        toolsUsed,
        charts,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sofia error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
