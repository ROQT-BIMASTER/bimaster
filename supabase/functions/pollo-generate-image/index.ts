import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const POLLO_API_KEY = Deno.env.get('POLLO_API_KEY');
    if (!POLLO_API_KEY) {
      throw new Error('POLLO_API_KEY não configurada');
    }

    const { prompt, width = 1024, height = 1024 } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt é obrigatório' }), 
        { 
          status: 400, 
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Gerando imagem com Pollo.ai:', { prompt, width, height });

    // Chamar a API da Pollo.ai para geração de imagem
    const response = await fetch('https://api.pollo.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${POLLO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        model: 'pollo-1.5-xl',
        width,
        height,
        num_outputs: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro da API Pollo.ai:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido, tente novamente mais tarde.' }), 
          { 
            status: 429, 
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
          }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `Erro ao gerar imagem: ${response.status}` }), 
        { 
          status: response.status, 
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log('Imagem gerada com sucesso');

    return new Response(
      JSON.stringify({ 
        imageUrl: data.data?.[0]?.url || data.output?.[0],
        metadata: {
          model: 'pollo-1.5-xl',
          prompt,
          dimensions: { width, height }
        }
      }), 
      { 
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Erro ao gerar imagem:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar imagem';
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      { 
        status: 500, 
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  }
});