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
    const { photos } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    if (!photos || photos.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma foto fornecida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare messages for AI with image analysis
    const messages = [
      {
        role: 'system',
        content: `Você é um especialista em análise de PDVs e trade marketing. Analise as fotos de gôndolas em DETALHE e extraia:

1. **Produtos Identificados**: Liste todos os produtos visíveis com suas marcas e tipos
2. **Share de Gôndola**: Conte quantas faces (unidades visíveis) há de produtos próprios vs concorrentes
3. **Posicionamento**: Avalie a altura (olhos, mãos, chão), localidade na gôndola
4. **Preços**: Identifique etiquetas de preço visíveis e compare se possível
5. **Problemas Críticos**: 
   - Rupturas (espaços vazios)
   - Produtos mal posicionados
   - Falta de material promocional
   - Preços incorretos ou ausentes
   - Produtos concorrentes com melhor exposição
6. **Oportunidades**: Sugestões para melhorar o share e visibilidade
7. **Análise de Concorrentes**: Se houver produtos concorrentes na mesma gôndola, compare:
   - Preços (se visíveis)
   - Número de faces
   - Posicionamento relativo
   - Materiais promocionais

Seja ESPECÍFICO e DETALHADO. Use dados numéricos sempre que possível.
Retorne a resposta em formato JSON estruturado com todas as informações.`
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analise estas fotos de gôndola em DETALHE. Identifique produtos, marcas, preços visíveis, problemas, e forneça uma análise completa de share e competitividade. Se houver produtos concorrentes na mesma foto que produtos nossos, faça uma comparação direta.'
          },
          ...photos.slice(0, 3).map((photo: string) => ({
            type: 'image_url',
            image_url: { url: photo }
          }))
        ]
      }
    ];

    console.log('Chamando Lovable AI para análise de fotos...');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages,
        tools: [{
          type: 'function',
          function: {
            name: 'extract_shelf_data',
            description: 'Extrai dados estruturados e detalhados da análise de gôndola',
            parameters: {
              type: 'object',
              properties: {
                insights: {
                  type: 'string',
                  description: 'Resumo detalhado dos insights e recomendações'
                },
                products_detected: {
                  type: 'array',
                  items: { 
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      brand: { type: 'string' },
                      is_our_product: { type: 'boolean' },
                      visible_price: { type: 'number' },
                      facings: { type: 'number' },
                      position: { type: 'string' }
                    }
                  },
                  description: 'Lista detalhada de produtos detectados com informações'
                },
                our_facings: {
                  type: 'number',
                  description: 'Número total de faces de produtos próprios'
                },
                competitor_facings: {
                  type: 'number',
                  description: 'Número total de faces de concorrentes'
                },
                competitor_comparison: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      competitor_product: { type: 'string' },
                      our_product: { type: 'string' },
                      price_difference: { type: 'string' },
                      positioning_advantage: { type: 'string' },
                      recommendation: { type: 'string' }
                    }
                  },
                  description: 'Comparações diretas entre produtos nossos e concorrentes'
                },
                issues: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Problemas identificados com severidade'
                },
                opportunities: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Oportunidades de melhoria identificadas'
                },
                compliance_score: {
                  type: 'number',
                  description: 'Score de 0-100 de conformidade e qualidade de execução'
                },
                positioning_analysis: {
                  type: 'string',
                  description: 'Análise detalhada do posicionamento dos produtos'
                },
                price_competitiveness: {
                  type: 'string',
                  description: 'Análise de competitividade de preços quando visíveis'
                }
              },
              required: ['insights', 'products_detected', 'our_facings', 'competitor_facings', 'issues', 'compliance_score']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_shelf_data' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na API Lovable AI:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`Erro na API: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Resposta da IA:', JSON.stringify(data, null, 2));

    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const analysisResult = toolCall ? JSON.parse(toolCall.function.arguments) : {
      insights: 'Análise não disponível',
      products_detected: [],
      our_facings: 0,
      competitor_facings: 0,
      issues: [],
      compliance_score: 0
    };

    return new Response(
      JSON.stringify(analysisResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro na função analyze-shelf-photos:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro ao processar análise',
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
