import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

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

    const callGateway = async (model: string) => {
      return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
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
    };

    // Modelo primário estável para tool calling estrito
    let response = await callGateway("google/gemini-2.5-flash");

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json", "Retry-After": "60" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para IA." }), {
          status: 402, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("[audit-produto-tarefa] AI gateway error (primary):", status, t.slice(0, 500));
      // Fallback para outros modelos em erros não relacionados a cota
      response = await callGateway("openai/gpt-5-mini");
      if (!response.ok) {
        const t2 = await response.text();
        console.error("[audit-produto-tarefa] AI gateway error (fallback):", response.status, t2.slice(0, 500));
        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
    }

    let data = await response.json();
    let toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    // Se o modelo primário não devolveu tool_calls, tenta com fallback
    if (!toolCall?.function?.arguments) {
      console.warn("[audit-produto-tarefa] primary sem tool_calls, tentando fallback");
      const fallback = await callGateway("openai/gpt-5-mini");
      if (fallback.ok) {
        data = await fallback.json();
        toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      } else {
        const ft = await fallback.text();
        console.error("[audit-produto-tarefa] fallback HTTP error:", fallback.status, ft.slice(0, 300));
      }
    }

    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Último recurso: tenta extrair JSON do conteúdo livre
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return new Response(JSON.stringify(parsed), {
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      } catch {/* ignore */}
    }

    console.error("[audit-produto-tarefa] resposta sem tool_calls:", JSON.stringify(data).slice(0, 800));
    return new Response(JSON.stringify({ error: "IA não retornou avaliação estruturada. Tente reanalisar." }), {
      status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[audit-produto-tarefa] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
