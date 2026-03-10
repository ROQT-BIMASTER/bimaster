const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tarefa, submissao, projeto, modo } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Você é um auditor de qualidade especializado em rastreabilidade entre projetos de desenvolvimento de produtos cosméticos/FMCG no Brasil e submissões de fábricas na China.

Sua tarefa é analisar se o VÍNCULO entre uma tarefa/projeto brasileiro e uma submissão de produto China é coerente.

Analise cuidadosamente:
1. Se o código e nome do produto na submissão China correspondem ao produto vinculado à tarefa/projeto
2. Se a categoria/tipo da tarefa faz sentido para o produto da China (ex: tarefa de "Rótulo" vinculada a um produto que já tem rótulo aprovado)
3. Se há sinais de que o vínculo pode ser com o produto ERRADO (nomes diferentes, códigos incompatíveis, categorias divergentes)
4. Se os campos técnicos da submissão (EAN, fórmula, pesos) são consistentes com o escopo da tarefa
5. Se o status da submissão China é compatível com o estágio do projeto/tarefa

Responda SEMPRE com um JSON usando esta estrutura exata:
{
  "match": "alto" | "medio" | "baixo",
  "confianca": number (0-100),
  "motivo": "explicação curta de 1-2 frases em português",
  "alertas": ["alerta 1", "alerta 2"],
  "sugestao": "sugestão opcional de ação corretiva ou null"
}

Regras:
- "alto" = vínculo claramente correto, produto e contexto são compatíveis
- "medio" = possível compatibilidade mas há ambiguidades ou dados insuficientes
- "baixo" = provável incompatibilidade, produto errado ou contexto incongruente
- Seja conciso e objetivo
- Sempre inclua pelo menos 1 alerta se match for "baixo"
- Se não houver contexto suficiente, retorne "medio" com motivo explicando`;

    let userPrompt = "";

    if (modo === "tarefa_produto") {
      // Linking a single task to a China product
      userPrompt = `MODO: Vinculação de Tarefa a Produto China

TAREFA:
- Título: ${tarefa?.titulo || "N/A"}
- Descrição: ${tarefa?.descricao || "Sem descrição"}
- Estágio: ${tarefa?.estagio || "N/A"}
- Seção: ${tarefa?.secao_nome || "N/A"}
- Prioridade: ${tarefa?.prioridade || "N/A"}

SUBMISSÃO CHINA:
- Código Produto: ${submissao?.produto_codigo || "N/A"}
- Nome Produto: ${submissao?.produto_nome || "N/A"}
- Status: ${submissao?.status || "N/A"}
- Fórmula: ${submissao?.formula_codigo || "N/A"}
- EAN Unidade: ${submissao?.ean_unidade || "N/A"}
- EAN Display: ${submissao?.ean_display || "N/A"}
- EAN Caixa Master: ${submissao?.ean_caixa_master || "N/A"}
- Peso Líquido: ${submissao?.peso_liquido_g || "N/A"}g
- Peso Bruto: ${submissao?.peso_bruto_g || "N/A"}g
- Qtd Total: ${submissao?.qty_total || "N/A"}
- Obs Brasil: ${submissao?.observacoes_brasil || "Nenhuma"}
- Obs China: ${submissao?.observacoes_china || "Nenhuma"}

Avalie se esta tarefa faz sentido vinculada a este produto da China.`;
    } else {
      // Creating a full project from a China submission
      userPrompt = `MODO: Criação de Projeto de Desenvolvimento a partir de Submissão China

PROJETO:
- Nome: ${projeto?.nome || "N/A"}
- Seções: ${projeto?.secoes?.join(", ") || "N/A"}

SUBMISSÃO CHINA:
- Código Produto: ${submissao?.produto_codigo || "N/A"}
- Nome Produto: ${submissao?.produto_nome || "N/A"}
- Status: ${submissao?.status || "N/A"}
- Fórmula: ${submissao?.formula_codigo || "N/A"}
- EAN Unidade: ${submissao?.ean_unidade || "N/A"}
- EAN Display: ${submissao?.ean_display || "N/A"}
- EAN Caixa Master: ${submissao?.ean_caixa_master || "N/A"}
- Peso Líquido: ${submissao?.peso_liquido_g || "N/A"}g
- Peso Bruto: ${submissao?.peso_bruto_g || "N/A"}g
- Qtd Total: ${submissao?.qty_total || "N/A"}
- Obs Brasil: ${submissao?.observacoes_brasil || "Nenhuma"}
- Obs China: ${submissao?.observacoes_china || "Nenhuma"}
- Nº Ordem: ${submissao?.numero_ordem || "N/A"}
- Nº Item: ${submissao?.numero_item || "N/A"}

Avalie se o projeto de desenvolvimento é compatível com esta submissão China. 
Verifique se o produto tem dados suficientes para iniciar um projeto (EAN, pesos, fórmula).
Identifique campos críticos faltantes que podem bloquear etapas do projeto.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "audit_vinculo",
              description: "Return the audit result for China-Brazil task/project link validation",
              parameters: {
                type: "object",
                properties: {
                  match: { type: "string", enum: ["alto", "medio", "baixo"] },
                  confianca: { type: "number" },
                  motivo: { type: "string" },
                  alertas: { type: "array", items: { type: "string" } },
                  sugestao: { type: "string" },
                },
                required: ["match", "confianca", "motivo", "alertas"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "audit_vinculo" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para IA." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try parsing content as JSON
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return new Response(jsonMatch[0], {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ match: "medio", confianca: 50, motivo: "Não foi possível avaliar o vínculo.", alertas: [], sugestao: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("audit-china-vinculo error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
