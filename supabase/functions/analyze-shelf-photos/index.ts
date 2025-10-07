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
        content: `Você é um especialista em análise de PDVs e trade marketing. Analise as fotos de gôndolas e extraia:
1. Produtos identificados (seus SKUs se reconhecíveis)
2. Número de faces de produtos próprios vs concorrentes
3. Problemas detectados (rupturas, precificação incorreta, má posição, falta de material promocional)
4. Insights gerais sobre exposição e share de gôndola

Retorne a resposta em formato JSON estruturado.`
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analise estas fotos de gôndola e forneça insights detalhados sobre share, produtos, e problemas.'
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
        model: 'google/gemini-2.5-flash',
        messages,
        tools: [{
          type: 'function',
          function: {
            name: 'extract_shelf_data',
            description: 'Extrai dados estruturados da análise de gôndola',
            parameters: {
              type: 'object',
              properties: {
                insights: {
                  type: 'string',
                  description: 'Resumo geral dos insights'
                },
                products_detected: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Lista de produtos/SKUs detectados'
                },
                our_facings: {
                  type: 'number',
                  description: 'Número estimado de faces de produtos próprios'
                },
                competitor_facings: {
                  type: 'number',
                  description: 'Número estimado de faces de concorrentes'
                },
                issues: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Problemas identificados'
                },
                compliance_score: {
                  type: 'number',
                  description: 'Score de 0-100 de conformidade'
                }
              },
              required: ['insights', 'products_detected', 'our_facings', 'competitor_facings', 'issues']
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
