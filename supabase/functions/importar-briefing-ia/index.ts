import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { validateJWT } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { z, validateBody, sanitizeString } from "../_shared/validate.ts";
import { handleError } from "../_shared/error-handler.ts";

const ImportBriefingSchema = z.object({
  textoExtraido: z.string().min(1).max(100000),
});

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const corsHeaders = getCorsHeaders(req);

  try {
    const auth = await validateJWT(req);
    await checkRateLimit({ prefix: "importar-briefing", limit: 20, req, userId: auth.userId });

    const body = await req.json();
    const { textoExtraido } = validateBody(body, ImportBriefingSchema);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const systemPrompt = `Você é um especialista em gestão de projetos de produtos cosméticos. Sua tarefa é analisar o texto extraído de uma planilha de Briefing e retornar os dados organizados em campos estruturados.

A planilha contém seções como:
- PRODUTO: Nome comercial, ativos, apelos, variações
- ROTULAGEM: Descrição, modo de uso, composição, SKU, EAN, selos
- COMPRAS E EMBALAGEM: Fabricante, tipo plástico, dimensões

Cada campo pode ter siglas de responsabilidade:
- (D) = Desenvolvimento
- (C) = Criação de Arte  
- (R) = Regulatório
- (E) = Embalagens
- (COMP) = Compras

Você deve retornar os campos estruturados usando a função extract_briefing_fields.

Regras:
1. Extraia TODOS os campos presentes na planilha
2. Agrupe por categoria (PRODUTO, ROTULAGEM, COMPRAS E EMBALAGEM, ou outra encontrada)
3. Use o nome exato do campo como aparece na planilha
4. Extraia o valor real preenchido
5. Identifique a sigla de responsabilidade quando presente
6. Mantenha a ordem lógica dos campos dentro de cada categoria`;

    const userPrompt = `Texto extraído da planilha de Briefing:\n\n${sanitizeString(textoExtraido, 100000)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_briefing_fields",
              description: "Retorna os campos estruturados extraídos do briefing",
              parameters: {
                type: "object",
                properties: {
                  campos: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        categoria: { type: "string" },
                        campo: { type: "string" },
                        valor: { type: "string" },
                        responsabilidade: { type: "string" },
                      },
                      required: ["categoria", "campo", "valor"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["campos"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_briefing_fields" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json", "Retry-After": "60" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "IA não retornou campos estruturados" }), {
        status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(parsed), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    return handleError(e, getCorsHeaders(req));
  }
});
