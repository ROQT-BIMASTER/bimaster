import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  const headers = { ...getCorsHeaders(req), "Content-Type": "application/json" };

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { action, categorias } = await req.json();

    // Action: load-categories — fetch distinct categories with stats via raw SQL
    if (action === "load-categories") {
      const { data, error } = await supabase.rpc("exec_sql_readonly", { sql_query: "" });
      
      // Use direct query approach
      const { data: cats, error: catErr } = await supabase
        .from("contas_pagar")
        .select("categoria_nome, fornecedor_nome, valor_original")
        .not("categoria_nome", "is", null);

      if (catErr) throw catErr;

      // Aggregate in memory (service role bypasses RLS, gets all rows)
      const catMap = new Map<string, { qtd: number; valores: number[]; fornecedores: Map<string, number> }>();

      for (const r of cats || []) {
        const cat = r.categoria_nome;
        if (!cat) continue;
        if (!catMap.has(cat)) {
          catMap.set(cat, { qtd: 0, valores: [], fornecedores: new Map() });
        }
        const entry = catMap.get(cat)!;
        entry.qtd++;
        if (r.valor_original) entry.valores.push(Number(r.valor_original));
        if (r.fornecedor_nome) {
          entry.fornecedores.set(r.fornecedor_nome, (entry.fornecedores.get(r.fornecedor_nome) || 0) + 1);
        }
      }

      const result = Array.from(catMap.entries()).map(([nome, info]) => ({
        categoria_nome: nome,
        qtd_titulos: info.qtd,
        valor_medio: info.valores.length > 0 ? info.valores.reduce((a, b) => a + b, 0) / info.valores.length : 0,
        top_fornecedores: Array.from(info.fornecedores.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([f]) => f),
      }));

      result.sort((a, b) => b.qtd_titulos - a.qtd_titulos);

      return new Response(JSON.stringify({ success: true, categorias: result }), { headers });
    }

    // Action: classify — classify a batch of categories using AI
    if (action === "classify") {
      if (!categorias || !Array.isArray(categorias) || categorias.length === 0) {
        return new Response(JSON.stringify({ error: "categorias array required" }), { status: 400, headers });
      }

      // Get chart of accounts
      const { data: contas } = await supabase
        .from("trade_chart_of_accounts")
        .select("id, code, name, account_type, categoria_dre")
        .eq("permite_lancamento", true)
        .order("code");

      if (!contas || contas.length === 0) {
        return new Response(JSON.stringify({ error: "No chart of accounts found" }), { status: 400, headers });
      }

      const planoText = contas.map(c => `${c.code} - ${c.name} (${c.categoria_dre || c.account_type})`).join("\n");

      const categoriasText = categorias.map((c: any) =>
        `- "${c.categoria_nome}" (${c.qtd_titulos} títulos, valor médio R$${c.valor_medio?.toFixed(2) || '0'}, fornecedores: ${(c.top_fornecedores || []).join(', ') || 'N/A'})`
      ).join("\n");

      const systemPrompt = `Você é um contador profissional especializado em classificação contábil (plano de contas DRE).
Seu trabalho é mapear categorias vindas de um ERP para o plano de contas correto.

PLANO DE CONTAS DISPONÍVEL:
${planoText}

REGRAS:
1. Cada categoria deve ser mapeada para EXATAMENTE uma conta analítica (que permite lançamento)
2. Considere o nome da categoria, os fornecedores típicos e os valores médios
3. Se a categoria é de RECEITA, use contas do grupo 1.x
4. Se é CUSTO de mercadoria/frete/imposto sobre venda, use grupo 2.x
5. Se é DESPESA fixa (admin/pessoal/marketing), use grupo 3.x
6. Se é atividade financeira/investimento/sócios, use grupo 4.x
7. Retorne um score de confiança de 0 a 1
8. IMPORTANTE: Use os códigos EXATAMENTE como listados no plano`;

      const userPrompt = `Classifique estas categorias do ERP para o plano de contas:

${categoriasText}

Responda usando a ferramenta fornecida.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "classificar_categorias",
              description: "Mapeia categorias do ERP para o plano de contas",
              parameters: {
                type: "object",
                properties: {
                  mapeamentos: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        categoria_nome: { type: "string", description: "Nome exato da categoria do ERP" },
                        plano_contas_codigo: { type: "string", description: "Código da conta no plano (ex: 3.1.2)" },
                        plano_contas_nome: { type: "string", description: "Nome da conta no plano" },
                        confianca: { type: "number", description: "Score de confiança de 0 a 1" },
                        justificativa: { type: "string", description: "Explicação curta da classificação" },
                      },
                      required: ["categoria_nome", "plano_contas_codigo", "plano_contas_nome", "confianca", "justificativa"],
                    },
                  },
                },
                required: ["mapeamentos"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "classificar_categorias" } },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI gateway error:", response.status, errText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Aguarde e tente novamente." }), { status: 429, headers });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), { status: 402, headers });
        }
        throw new Error(`AI error: ${response.status}`);
      }

      const aiData = await response.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("AI did not return tool call");

      const parsed = JSON.parse(toolCall.function.arguments);
      const mapeamentos = parsed.mapeamentos || [];

      // Enrich with plano_contas_id from DB
      const enriched = [];
      for (const m of mapeamentos) {
        const conta = contas.find(c => c.code === m.plano_contas_codigo);
        if (conta) {
          enriched.push({
            ...m,
            plano_contas_id: conta.id,
            plano_contas_nome: conta.name,
          });
        } else {
          enriched.push({ ...m, plano_contas_id: null });
        }
      }

      return new Response(JSON.stringify({ success: true, mapeamentos: enriched }), { headers });
    }

    // Action: save — save mappings to DB
    if (action === "save") {
      if (!categorias || !Array.isArray(categorias)) {
        return new Response(JSON.stringify({ error: "categorias array required" }), { status: 400, headers });
      }

      for (const m of categorias) {
        if (!m.plano_contas_id) continue;
        const { error } = await supabase
          .from("plano_contas_mapeamento_categorias")
          .upsert({
            categoria_nome: m.categoria_nome,
            plano_contas_id: m.plano_contas_id,
            plano_contas_codigo: m.plano_contas_codigo,
            plano_contas_nome: m.plano_contas_nome,
            confianca: m.confianca,
            justificativa: m.justificativa,
            revisado_manualmente: m.revisado_manualmente || false,
            qtd_titulos: m.qtd_titulos || 0,
            valor_medio: m.valor_medio || 0,
            top_fornecedores: m.top_fornecedores || [],
          }, { onConflict: "categoria_nome" });

        if (error) console.error("Upsert error:", error);
      }

      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Action: apply — bulk update contas_pagar
    if (action === "apply") {
      const { data, error } = await supabase.rpc("aplicar_mapeamento_plano_contas");
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers });
  }
});
