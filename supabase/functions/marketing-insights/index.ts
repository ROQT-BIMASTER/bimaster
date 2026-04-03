import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { validateJWT } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { z, validateBody, sanitizeString } from "../_shared/validate.ts";
import { handleError } from "../_shared/error-handler.ts";

const MarketingInsightsSchema = z.object({
  question: z.string().min(1).max(5000),
  dashboardContext: z.string().max(20000).optional().default(""),
});

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const corsHeaders = getCorsHeaders(req);

  try {
    const auth = await validateJWT(req);
    await checkRateLimit({ prefix: "marketing-insights", limit: 20, req, userId: auth.userId });

    const body = await req.json();
    const { question, dashboardContext } = validateBody(body, MarketingInsightsSchema);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

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

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: sanitizeString(question, 5000) }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente mais tarde.' }),
          { status: 429, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json', 'Retry-After': '60' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao seu workspace Lovable.' }),
          { status: 402, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('Erro na API de IA:', response.status, errorText);
      throw new Error('Erro ao gerar insights');
    }

    const data = await response.json();
    const insight = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ insight }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return handleError(error, getCorsHeaders(req));
  }
});
