import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  try {
    const { tarefa, produto, briefingCampos } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Você é um auditor de qualidade de projetos de desenvolvimento de produtos cosméticos/FMCG.

Sua tarefa é analisar se o conteúdo de um BRIEFING importado (campos extraídos de uma planilha) corresponde corretamente ao produto vinculado e à tarefa do projeto.

Analise:
1. Se os campos do briefing (nome do produto, código, marca, linha, etc.) correspondem ao produto vinculado
2. Se o conteúdo do briefing faz sentido no contexto da tarefa (título, descrição, estágio)
3. Se há campos do briefing que indicam um produto diferente do que está vinculado
4. Se há inconsistências entre categorias do briefing e o tipo de tarefa

Responda SEMPRE com um JSON usando esta estrutura exata:
{
  "match": "alto" | "medio" | "baixo",
  "confianca": number (0-100),
  "motivo": "explicação curta de 1-2 frases",
  "alertas": ["alerta 1", "alerta 2"]
}

Regras:
- "alto" = briefing claramente corresponde ao produto e tarefa
- "medio" = possível correspondência mas há ambiguidades
- "baixo" = provável incompatibilidade entre briefing e produto/tarefa
- Seja conciso e objetivo
- Se não houver contexto suficiente para avaliar, retorne "medio" com motivo explicando a falta de dados`;

    const camposResume = (briefingCampos || [])
      .slice(0, 40)
      .map((c: any) => `[${c.categoria}] ${c.campo}: ${c.valor || "vazio"}`)
      .join("\n");

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

CAMPOS DO BRIEFING (${(briefingCampos || []).length} campos):
${camposResume || "Nenhum campo"}`;

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
              description: "Return the audit result for briefing-product-task match",
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
          status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para IA." }), {
          status: 402, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
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
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Fallback: try parsing content as JSON
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return new Response(jsonMatch[0], {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ match: "medio", confianca: 50, motivo: "Não foi possível avaliar.", alertas: [] }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("audit-briefing error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
