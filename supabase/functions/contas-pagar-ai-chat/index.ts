import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { secureHandler } from "../_shared/secure-handler.ts";

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
  {
    type: "function",
    function: {
      name: "calculadora_financeira",
      description: "Calculadora financeira avançada. Calcula juros compostos, descontos, multas, correção monetária, parcelas, valor presente/futuro, e simulações de pagamento. Use sempre que o usuário pedir cálculos, simulações ou projeções numéricas.",
      parameters: {
        type: "object",
        properties: {
          operacao: {
            type: "string",
            enum: ["juros_compostos", "desconto_antecipacao", "multa_atraso", "parcelamento", "valor_presente", "valor_futuro", "correcao_monetaria"],
            description: "Tipo de cálculo a realizar",
          },
          valor_principal: { type: "number", description: "Valor base para o cálculo" },
          taxa_percentual: { type: "number", description: "Taxa em percentual (ex: 2 para 2%)" },
          periodo_dias: { type: "number", description: "Período em dias" },
          periodo_meses: { type: "number", description: "Período em meses" },
          num_parcelas: { type: "number", description: "Número de parcelas para parcelamento" },
          taxa_multa: { type: "number", description: "Taxa de multa em percentual (padrão 2%)" },
          taxa_juros_dia: { type: "number", description: "Taxa de juros ao dia em percentual (padrão 0.033%)" },
        },
        required: ["operacao", "valor_principal"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_contas_a_vencer",
      description: "Busca contas a pagar que vencem nos próximos dias. Útil para planejamento de pagamentos.",
      parameters: {
        type: "object",
        properties: {
          dias: { type: "number", description: "Próximos N dias (padrão 7)" },
          limite: { type: "number", description: "Quantidade máxima de resultados (padrão 30)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resumo_contas_por_status",
      description: "Resumo rápido das contas a pagar agrupado por status (aberto, pago, vencido, parcial).",
      parameters: {
        type: "object",
        properties: {},
        required: [],
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

    case "calculadora_financeira": {
      const valor = args.valor_principal as number;
      const operacao = args.operacao as string;
      const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      switch (operacao) {
        case "juros_compostos": {
          const taxa = ((args.taxa_percentual as number) || 1) / 100;
          const meses = (args.periodo_meses as number) || (args.periodo_dias ? Math.ceil((args.periodo_dias as number) / 30) : 12);
          const montante = valor * Math.pow(1 + taxa, meses);
          const juros = montante - valor;
          return `**Juros Compostos:**\n- Principal: R$ ${fmt(valor)}\n- Taxa: ${(taxa * 100).toFixed(2)}% a.m.\n- Período: ${meses} meses\n- **Montante: R$ ${fmt(montante)}**\n- Juros: R$ ${fmt(juros)}`;
        }
        case "desconto_antecipacao": {
          const taxa = ((args.taxa_percentual as number) || 2) / 100;
          const dias = (args.periodo_dias as number) || 30;
          const desconto = valor * taxa * (dias / 30);
          const valorLiquido = valor - desconto;
          return `**Desconto por Antecipação:**\n- Valor original: R$ ${fmt(valor)}\n- Taxa: ${(taxa * 100).toFixed(2)}% a.m.\n- Dias de antecipação: ${dias}\n- Desconto: R$ ${fmt(desconto)}\n- **Valor líquido: R$ ${fmt(valorLiquido)}**\n- Economia: ${((desconto / valor) * 100).toFixed(2)}%`;
        }
        case "multa_atraso": {
          const dias = (args.periodo_dias as number) || 1;
          const multa = ((args.taxa_multa as number) || 2) / 100;
          const jurosDia = ((args.taxa_juros_dia as number) || 0.033) / 100;
          const valorMulta = valor * multa;
          const valorJuros = valor * jurosDia * dias;
          const total = valor + valorMulta + valorJuros;
          return `**Cálculo de Multa e Juros por Atraso:**\n- Valor original: R$ ${fmt(valor)}\n- Dias de atraso: ${dias}\n- Multa (${(multa * 100).toFixed(1)}%): R$ ${fmt(valorMulta)}\n- Juros (${(jurosDia * 100).toFixed(3)}%/dia × ${dias}d): R$ ${fmt(valorJuros)}\n- **Total a pagar: R$ ${fmt(total)}**\n- Acréscimo: R$ ${fmt(total - valor)} (${(((total - valor) / valor) * 100).toFixed(2)}%)`;
        }
        case "parcelamento": {
          const parcelas = (args.num_parcelas as number) || 3;
          const taxa = ((args.taxa_percentual as number) || 0) / 100;
          if (taxa === 0) {
            const valorParcela = valor / parcelas;
            return `**Parcelamento sem juros:**\n- Valor total: R$ ${fmt(valor)}\n- Parcelas: ${parcelas}x de R$ ${fmt(valorParcela)}`;
          }
          const pmt = valor * (taxa * Math.pow(1 + taxa, parcelas)) / (Math.pow(1 + taxa, parcelas) - 1);
          const totalPago = pmt * parcelas;
          return `**Parcelamento com juros:**\n- Valor original: R$ ${fmt(valor)}\n- Taxa: ${(taxa * 100).toFixed(2)}% a.m.\n- ${parcelas}x de **R$ ${fmt(pmt)}**\n- Total pago: R$ ${fmt(totalPago)}\n- Juros total: R$ ${fmt(totalPago - valor)}`;
        }
        case "valor_presente": {
          const taxa = ((args.taxa_percentual as number) || 1) / 100;
          const meses = (args.periodo_meses as number) || 12;
          const vp = valor / Math.pow(1 + taxa, meses);
          return `**Valor Presente:**\n- Valor futuro: R$ ${fmt(valor)}\n- Taxa: ${(taxa * 100).toFixed(2)}% a.m.\n- Período: ${meses} meses\n- **Valor presente: R$ ${fmt(vp)}**`;
        }
        case "valor_futuro": {
          const taxa = ((args.taxa_percentual as number) || 1) / 100;
          const meses = (args.periodo_meses as number) || 12;
          const vf = valor * Math.pow(1 + taxa, meses);
          return `**Valor Futuro:**\n- Valor atual: R$ ${fmt(valor)}\n- Taxa: ${(taxa * 100).toFixed(2)}% a.m.\n- Período: ${meses} meses\n- **Valor futuro: R$ ${fmt(vf)}**`;
        }
        case "correcao_monetaria": {
          const taxa = ((args.taxa_percentual as number) || 0.5) / 100;
          const meses = (args.periodo_meses as number) || (args.periodo_dias ? Math.ceil((args.periodo_dias as number) / 30) : 12);
          const corrigido = valor * Math.pow(1 + taxa, meses);
          return `**Correção Monetária:**\n- Valor original: R$ ${fmt(valor)}\n- Índice mensal: ${(taxa * 100).toFixed(2)}%\n- Período: ${meses} meses\n- **Valor corrigido: R$ ${fmt(corrigido)}**\n- Diferença: R$ ${fmt(corrigido - valor)}`;
        }
        default:
          return "Operação de cálculo não reconhecida.";
      }
    }

    case "buscar_contas_a_vencer": {
      const dias = (args.dias as number) || 7;
      const limite = (args.limite as number) || 30;
      const dataFim = new Date(hoje.getTime() + dias * 86400000).toISOString().split("T")[0];

      const { data, error } = await sb
        .from("contas_pagar")
        .select("fornecedor_nome, valor_original, valor_aberto, data_vencimento, status, categoria_nome")
        .gte("data_vencimento", dataHoje)
        .lte("data_vencimento", dataFim)
        .neq("status", "pago")
        .order("data_vencimento", { ascending: true })
        .limit(limite);

      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return `Nenhuma conta a vencer nos próximos ${dias} dias.`;

      const total = data.reduce((s: number, c: any) => s + (c.valor_aberto || 0), 0);
      const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
      const linhas = data.slice(0, 15).map((c: any) => {
        const diasP = Math.ceil((new Date(c.data_vencimento).getTime() - hoje.getTime()) / 86400000);
        return `• ${c.fornecedor_nome || "N/I"}: R$ ${fmt(c.valor_aberto || 0)} — vence em ${diasP}d (${c.data_vencimento?.substring(0, 10)})`;
      });

      return `**${data.length} contas a vencer nos próximos ${dias} dias** (total: R$ ${fmt(total)}):\n\n${linhas.join("\n")}${data.length > 15 ? `\n\n... e mais ${data.length - 15} títulos.` : ""}`;
    }

    case "resumo_contas_por_status": {
      const data = await fetchAll(sb, "contas_pagar", "status, valor_aberto, valor_original, data_vencimento");
      const resumo: Record<string, { qtd: number; aberto: number; original: number }> = {};
      let vencidasCount = 0;
      let vencidasValor = 0;

      data.forEach((c: any) => {
        const st = c.status || "N/I";
        if (!resumo[st]) resumo[st] = { qtd: 0, aberto: 0, original: 0 };
        resumo[st].qtd++;
        resumo[st].aberto += c.valor_aberto || 0;
        resumo[st].original += c.valor_original || 0;
        if (c.data_vencimento < dataHoje && c.status !== "pago") {
          vencidasCount++;
          vencidasValor += c.valor_aberto || 0;
        }
      });

      const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
      const linhas = Object.entries(resumo)
        .sort((a, b) => b[1].aberto - a[1].aberto)
        .map(([st, d]) => `| ${st} | ${d.qtd} | R$ ${fmt(d.original)} | R$ ${fmt(d.aberto)} |`);

      return `**Resumo por Status:**\n\n| Status | Qtd | Valor Original | Valor Aberto |\n|---|---|---|---|\n${linhas.join("\n")}\n\n⚠️ **Vencidas:** ${vencidasCount} títulos — R$ ${fmt(vencidasValor)}`;
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

const SYSTEM_PROMPT = `Você é Sofia, analista financeira sênior especializada em contas a pagar. O dono da empresa é libanês — seja respeitosa e profissional.

## REGRA #1: SEMPRE CONSULTE OS DADOS
- NUNCA invente números. Se o usuário perguntar qualquer coisa sobre contas, fornecedores, vencimentos, valores — USE UMA FERRAMENTA.
- Na DÚVIDA, use "resumo_contas_por_status" ou "buscar_contas_vencidas" como ponto de partida.
- Use MÚLTIPLAS ferramentas quando necessário para dar uma resposta completa.

## REGRA #2: FORMATO OBRIGATÓRIO
Toda resposta DEVE seguir este formato:
1. **Dado principal** em negrito (1 linha)
2. **Tabela** com os dados detalhados (use tabela markdown sempre que houver 3+ itens)
3. **Insight** (1 frase curta)
4. **Ação recomendada** (1 frase, se aplicável)

NÃO use listas com bullet points para dados financeiros — use TABELAS.

## REGRA #3: OBJETIVIDADE EXTREMA
- Máximo 150 palavras de texto (fora tabelas).
- PROIBIDO: "Claro!", "Com certeza!", "Vou verificar...", "Boa pergunta!", saudações longas.
- Comece DIRETO com o dado mais importante.
- Use ⚠️ para alertas críticos, ✅ para ok, 📊 para métricas.

## REGRA #4: GRÁFICOS AUTOMÁTICOS
- Se o usuário pedir "relatório", "análise completa", "visão geral" ou "dashboard": GERE pelo menos 2 gráficos automaticamente.
- Se comparar fornecedores: gráfico de barras.
- Se evolução temporal: gráfico de linha ou área.
- Se distribuição: gráfico de pizza.

## Ferramentas disponíveis:
- buscar_contas_vencidas, buscar_contas_a_vencer, buscar_contas_por_fornecedor
- resumo_fluxo_caixa, analise_aging, top_fornecedores_gastos
- gerar_relatorio_executivo, gerar_dados_grafico
- calculadora_financeira (juros, multas, parcelamento, VP/VF)
- resumo_contas_por_status

## Legislação (cite BREVEMENTE só se relevante):
- Multa padrão: 2% + 0,033%/dia
- Prazo legal: 30 dias (Lei 14.133/2021)

Responda em PT-BR. Valores em R$. Acesso a TODO o histórico.`;

// ────────── MAIN HANDLER ──────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

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
        tool_choice: "auto",
        temperature: 0.2,
        max_tokens: 2000,
      }),
    });

    if (!firstRes.ok) {
      const t = await firstRes.text();
      console.error("AI error:", firstRes.status, t);
      if (firstRes.status === 429) {
        return new Response(JSON.stringify({ success: false, error: "Muitas solicitações. Aguarde um momento." }),
          { status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
      }
      if (firstRes.status === 402) {
        return new Response(JSON.stringify({ success: false, error: "Créditos de IA esgotados." }),
          { status: 402, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
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
          temperature: 0.2,
          max_tokens: 2000,
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
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sofia error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
