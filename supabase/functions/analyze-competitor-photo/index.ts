import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    console.log('🔍 [analyze-competitor] Iniciando análise de foto');
    
    const { imageBase64 } = await req.json();
    
    if (!imageBase64) {
      throw new Error('Imagem não fornecida');
    }

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    console.log('📸 [analyze-competitor] Chamando Lovable AI...');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5.2',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em análise competitiva de produtos. Analise imagens de produtos concorrentes e forneça insights detalhados sobre posicionamento, preço, embalagem, visibilidade e estratégia de mercado.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analise esta foto de produto concorrente e forneça um relatório estruturado com: 1) Descrição do produto visível, 2) Posicionamento na gôndola/prateleira, 3) Estratégia de preço aparente, 4) Qualidade da embalagem e branding, 5) Nível de visibilidade/destaque, 6) Pontos fortes e fracos identificados, 7) Recomendações estratégicas.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [analyze-competitor] Erro da API:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Limite de requisições excedido. Tente novamente em alguns instantes.');
      }
      if (response.status === 402) {
        throw new Error('Créditos insuficientes. Adicione créditos em Configurações > Workspace > Usage.');
      }
      
      throw new Error('Erro ao analisar imagem');
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content;
    
    if (!analysis) {
      throw new Error('Resposta inválida da IA');
    }

    console.log('✅ [analyze-competitor] Análise concluída');

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ [analyze-competitor] Erro:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { 
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});
