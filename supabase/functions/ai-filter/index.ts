import { secureHandler } from "../_shared/secure-handler.ts";
import { z, validateBody } from "../_shared/validate.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const FilterSchema = z
  .object({
    query: z.string().min(1).max(2000),
  })
  .strict();

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 30, rateLimitPrefix: "ai-filter" },
    async (req) => {
      const cors = getCorsHeaders(req);
      const jsonHeaders = { ...cors, "Content-Type": "application/json" };

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(
          JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
          { status: 503, headers: jsonHeaders }
        );
      }

      const body = await req.json().catch(() => ({}));
      const { query } = validateBody(body, FilterSchema);

      const systemPrompt = `Você é um assistente especializado em filtrar dados de Trade Marketing.
O usuário vai descrever o que quer ver em linguagem natural, e você deve retornar critérios de filtro estruturados.

Retorne um objeto JSON com os seguintes campos possíveis:
{
  "dateRange": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "status": ["status1", "status2"],
  "type": "tipo",
  "aiProcessed": true/false,
  "priority": "alta/media/baixa",
  "category": "categoria",
  "completed": true/false,
  "timeframe": "hoje/semana/mes"
}

Exemplos:
- "visitas da última semana" → { "timeframe": "semana", "entityType": "visits" }
- "promoções ativas" → { "status": ["active"], "entityType": "promotions" }
- "fotos não processadas pela IA" → { "aiProcessed": false, "entityType": "photos" }
- "investimentos pendentes de aprovação" → { "status": ["pending"], "entityType": "investments" }
- "concorrentes de ameaça alta" → { "priority": "alta", "entityType": "competitors" }`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5.2",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: query },
          ],
          temperature: 0.3,
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "Limite de requisições excedido, tente novamente em alguns instantes" }),
            { status: 429, headers: jsonHeaders }
          );
        }
        if (aiResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: "Créditos insuficientes. Por favor, adicione créditos ao workspace." }),
            { status: 402, headers: jsonHeaders }
          );
        }
        const errorText = await aiResponse.text();
        console.error("AI Gateway error:", aiResponse.status, errorText);
        return new Response(
          JSON.stringify({ error: "Erro no AI Gateway" }),
          { status: 502, headers: jsonHeaders }
        );
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content ?? "";

      let criteria: Record<string, unknown> = {};
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        criteria = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch {
        criteria = {};
      }

      return new Response(
        JSON.stringify({ criteria, rawQuery: query }),
        { headers: jsonHeaders }
      );
    }
  )
);
