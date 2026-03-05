const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tarefa, produto, documentos } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Você é um auditor de qualidade de projetos de desenvolvimento de produtos cosméticos/FMCG.

Sua tarefa é analisar se o produto vinculado a uma tarefa de projeto corresponde corretamente ao contexto da tarefa.

Analise:
1. Se o nome/código do produto faz sentido com o título e descrição da tarefa
2. Se os documentos do cofre (nomes de arquivos, categorias) são compatíveis com o produto
3. Se há inconsistências que indicam que o produto errado foi selecionado

Responda SEMPRE com um JSON usando esta estrutura exata:
{
  "match": "alto" | "medio" | "baixo",
  "confianca": number (0-100),
  "motivo": "explicação curta de 1-2 frases",
  "alertas": ["alerta 1", "alerta 2"] // lista vazia se não houver alertas
}

Regras:
- "alto" = produto claramente corresponde à tarefa
- "medio" = possível correspondência mas há ambiguidades
- "baixo" = provável incompatibilidade
- Seja conciso e objetivo
- Se não houver contexto suficiente para avaliar, retorne "medio" com motivo explicando a falta de dados`;

    const userPrompt = `TAREFA:
- Título: ${tarefa.titulo}
- Descrição: ${tarefa.descricao || "Sem descrição"}
- Estágio: ${tarefa.estagio || "Não definido"}
- Código: ${tarefa.codigo || "Sem código"}

PRODUTO VINCULADO:
- Código: ${produto.codigo}
- Nome: ${produto.nome}
- Marca: ${produto.marca || "N/A"}
- Linha: ${produto.linha || "N/A"}
- Tipo: ${produto.tipo || "N/A"}

DOCUMENTOS NO COFRE (${documentos.length}):
${documentos.length > 0 ? documentos.map((d: any) => `- ${d.nome_arquivo} (categoria: ${d.categoria || "sem categoria"})`).join("\n") : "Nenhum documento"}`;

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
              name: "audit_result",
              description: "Return the audit result for product-task match",
              parameters: {
                type: "object",
                properties: {
                  match: { type: "string", enum: ["alto", "medio", "baixo"] },
                  confianca: { type: "number" },
                  motivo: { type: "string" },
                  alertas: { type: "array", items: { type: "string" } },
                },
                required: ["match", "confianca", "motivo", "alertas"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "audit_result" } },
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

    return new Response(JSON.stringify({ match: "medio", confianca: 50, motivo: "Não foi possível avaliar.", alertas: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("audit error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
