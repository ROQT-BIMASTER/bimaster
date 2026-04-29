import { secureHandler } from "../_shared/secure-handler.ts";
import { z, validateBody, sanitizeString } from "../_shared/validate.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const MarketingInsightsSchema = z
  .object({
    question: z.string().min(1).max(5000),
    dashboardContext: z.string().max(20000).optional().default(""),
  })
  .strict();

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 20, rateLimitPrefix: "marketing-insights" },
    async (req) => {
      const cors = getCorsHeaders(req);
      const jsonHeaders = { ...cors, "Content-Type": "application/json" };

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(
          JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
          { status: 503, headers: jsonHeaders }
        );
      }

      const body = await req.json().catch(() => ({}));
      const { question, dashboardContext } = validateBody(body, MarketingInsightsSchema);

      const systemPrompt = `Você é um analista de marketing sênior especializado em performance digital e growth.

## SUAS CAPACIDADES:
- Análise profunda de métricas de marketing (CAC, LTV, ROAS, CTR, etc.)
- Geração de relatórios executivos com recomendações
- Criação de gráficos e visualizações de dados
- Identificação de tendências e anomalias
- Benchmarking e análise competitiva
- Previsões de performance baseadas em dados históricos

## FORMATO DE GRÁFICOS:
Para visualizações, use:
\`\`\`chart
{"type":"bar|line|pie|area","title":"Título","data":[{"name":"Label","value":123}]}
\`\`\`

## FORMATO DE RELATÓRIOS:
- Use tabelas markdown para comparativos
- Destaque KPIs importantes com **negrito**
- Organize em seções claras (Resumo, Análise, Recomendações)
- Inclua métricas percentuais e variações

## CONTEXTO DOS DASHBOARDS:
${sanitizeString(dashboardContext, 20000)}

Responda em português brasileiro, seja estratégico e orientado a resultados.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: sanitizeString(question, 5000) },
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Limite de requisições excedido. Tente novamente mais tarde." }),
            { status: 429, headers: { ...jsonHeaders, "Retry-After": "60" } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao seu workspace." }),
            { status: 402, headers: jsonHeaders }
          );
        }
        const errorText = await response.text();
        console.error("Erro na API de IA:", response.status, errorText);
        return new Response(
          JSON.stringify({ error: "Erro ao gerar insights" }),
          { status: 502, headers: jsonHeaders }
        );
      }

      const data = await response.json();
      const insight = data.choices?.[0]?.message?.content ?? "";

      return new Response(
        JSON.stringify({ insight }),
        { headers: jsonHeaders }
      );
    }
  )
);
