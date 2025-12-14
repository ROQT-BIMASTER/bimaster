import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, dashboardContext } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

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
${dashboardContext}

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
          { role: 'user', content: question }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente mais tarde.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao seu workspace Lovable.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('Erro na API de IA:', response.status, errorText);
      throw new Error('Erro ao gerar insights');
    }

    const data = await response.json();
    const insight = data.choices[0].message.content;

    console.log('Insight gerado com sucesso');

    return new Response(
      JSON.stringify({ insight }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro em marketing-insights:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro ao gerar insights' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
