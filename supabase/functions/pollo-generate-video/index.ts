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

    const { prompt, image, length = 5, resolution = '720p' } = await req.json();

    if (!prompt && !image) {
      return new Response(
        JSON.stringify({ error: 'Prompt ou imagem é obrigatório' }), 
        { 
          status: 400, 
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Gerando vídeo com Pollo.ai:', { hasImage: !!image, length, resolution });

    // Chamar a API da Pollo.ai para geração de vídeo
    const response = await fetch('https://pollo.ai/api/platform/generation/pollo/pollo-v1-6', {
      method: 'POST',
      headers: {
        'x-api-key': POLLO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          prompt: prompt || '',
          image: image || undefined,
          resolution,
          length,
          mode: 'basic'
        }
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
        JSON.stringify({ error: `Erro ao gerar vídeo: ${response.status}` }), 
        { 
          status: response.status, 
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log('Vídeo iniciado com sucesso, taskId:', data.taskId);

    return new Response(
      JSON.stringify({ 
        taskId: data.taskId,
        status: data.status
      }), 
      { 
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Erro ao gerar vídeo:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar vídeo';
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      { 
        status: 500, 
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  }
});