import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


const SYSTEM_PROMPT = `Você é um especialista em química cosmética e regulamentação ANVISA.
Sua tarefa é extrair ingredientes de documentos técnicos (fichas técnicas, especificações, rótulos, COA).

Para cada ingrediente encontrado, retorne:
- nome_chines: nome em chinês (se disponível, senão null)
- inci_name: nome INCI padronizado (obrigatório)
- cas_no: número CAS (se disponível, senão null)
- funcao: uma das seguintes funções: colorant, fragrance, moisturizer, preservative, antioxidant, emollient, conditioner, surfactant, thickener, film_forming, skin_conditioning, perfume, outros
- percentual: percentual do ingrediente (se disponível, senão 0)

REGRAS:
- Padronize SEMPRE o INCI name conforme nomenclatura internacional
- Identifique a função mais adequada para cada ingrediente
- Se o documento tiver ingredientes em chinês, traduza para INCI name
- Se houver múltiplas cores/variações, identifique qual cor/variação cada percentual pertence
- Retorne os ingredientes na ordem em que aparecem no documento

Use a ferramenta extract_ingredients para retornar os dados estruturados.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { document_text, document_url } = await req.json();
    
    if (!document_text && !document_url) {
      return new Response(JSON.stringify({ error: "Forneça document_text ou document_url" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const userContent: any[] = [];
    
    if (document_text) {
      userContent.push({ type: "text", text: `Extraia todos os ingredientes deste documento:\n\n${document_text}` });
    }
    
    if (document_url) {
      userContent.push({ type: "text", text: `Extraia todos os ingredientes do documento na imagem abaixo:` });
      userContent.push({ type: "image_url", image_url: { url: document_url } });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_ingredients",
              description: "Retorna a lista de ingredientes extraídos do documento",
              parameters: {
                type: "object",
                properties: {
                  ingredientes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        nome_chines: { type: "string", description: "Nome em chinês do ingrediente" },
                        inci_name: { type: "string", description: "Nome INCI padronizado" },
                        cas_no: { type: "string", description: "Número CAS" },
                        funcao: { 
                          type: "string", 
                          enum: ["colorant", "fragrance", "moisturizer", "preservative", "antioxidant", "emollient", "conditioner", "surfactant", "thickener", "film_forming", "skin_conditioning", "perfume", "outros"],
                          description: "Função do ingrediente"
                        },
                        percentual: { type: "number", description: "Percentual do ingrediente (0-100)" },
                        cor_key: { type: "string", description: "Chave da cor/variação (ex: 1#, 2#) se aplicável" },
                      },
                      required: ["inci_name", "funcao"],
                    },
                  },
                  observacoes: {
                    type: "string",
                    description: "Observações ou alertas sobre a extração (ingredientes duvidosos, percentuais que não somam 100%, etc.)",
                  },
                },
                required: ["ingredientes"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_ingredients" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Configurações > Workspace > Uso." }), {
          status: 402,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("Erro no serviço de IA");
    }

    const data = await response.json();
    
    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      // Fallback: try to parse from content
      throw new Error("IA não retornou dados estruturados");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extrair-ingredientes-ia error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
