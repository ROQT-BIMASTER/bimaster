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
    const { website_url } = await req.json();

    if (!website_url) {
      return new Response(
        JSON.stringify({ error: 'website_url é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔍 Analisando site: ${website_url}`);

    // 1. Buscar conteúdo do site
    console.log('📥 Fazendo fetch do conteúdo do site...');
    const websiteResponse = await fetch(website_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BrandAnalyzer/1.0)',
      },
    });

    if (!websiteResponse.ok) {
      throw new Error(`Erro ao acessar site: ${websiteResponse.status}`);
    }

    const htmlContent = await websiteResponse.text();
    
    // Extrair texto relevante do HTML (remover scripts, styles, etc)
    const textContent = htmlContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 30000); // Limitar a 30k caracteres

    console.log(`📄 Conteúdo extraído: ${textContent.length} caracteres`);

    // 2. Analisar com IA usando Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    console.log('🤖 Enviando para análise com IA...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente especializado em analisar sites de marcas e extrair informações estruturadas sobre a marca e seus produtos.'
          },
          {
            role: 'user',
            content: `Analise o seguinte conteúdo de um site de marca e extraia:
1. Informações sobre a marca (descrição, valores, história)
2. Lista de produtos encontrados (nome, descrição, categoria)

Conteúdo do site:
${textContent}

Por favor, extraia o máximo de informações possível sobre a marca e seus produtos.`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_brand_info',
              description: 'Extrai informações estruturadas sobre a marca e produtos do site',
              parameters: {
                type: 'object',
                properties: {
                  brand: {
                    type: 'object',
                    properties: {
                      description: { 
                        type: 'string',
                        description: 'Descrição detalhada da marca, seus valores e história'
                      },
                      mission: {
                        type: 'string',
                        description: 'Missão e propósito da marca'
                      },
                      categories: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Principais categorias de produtos da marca'
                      }
                    },
                    required: ['description']
                  },
                  products: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { 
                          type: 'string',
                          description: 'Nome do produto'
                        },
                        description: {
                          type: 'string',
                          description: 'Descrição detalhada do produto'
                        },
                        category: {
                          type: 'string',
                          description: 'Categoria do produto'
                        },
                        sku: {
                          type: 'string',
                          description: 'SKU ou código do produto se disponível'
                        }
                      },
                      required: ['name', 'category']
                    },
                    description: 'Lista de produtos encontrados no site'
                  }
                },
                required: ['brand', 'products'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_brand_info' } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos em Configurações > Workspace > Usage.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('Erro da IA:', aiResponse.status, errorText);
      throw new Error('Erro ao analisar com IA');
    }

    const aiResult = await aiResponse.json();
    console.log('✅ Análise da IA concluída');

    // Extrair dados do tool call
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('IA não retornou dados estruturados');
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
    console.log('📊 Dados extraídos:', JSON.stringify(extractedData, null, 2));

    // Retornar dados para o usuário revisar e aprovar
    return new Response(
      JSON.stringify({
        success: true,
        brand: extractedData.brand,
        products: extractedData.products,
        products_count: extractedData.products.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na análise:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
