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

    const { taskId } = await req.json();

    if (!taskId) {
      return new Response(
        JSON.stringify({ error: 'Task ID é obrigatório' }), 
        { 
          status: 400, 
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Verificando status do task:', taskId);

    // Verificar status da tarefa na API da Pollo.ai
    const response = await fetch(`https://pollo.ai/api/platform/query/${taskId}`, {
      method: 'GET',
      headers: {
        'x-api-key': POLLO_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro ao verificar status:', response.status, errorText);
      
      return new Response(
        JSON.stringify({ error: `Erro ao verificar status: ${response.status}` }), 
        { 
          status: response.status, 
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log('Status da tarefa:', data.status);

    return new Response(
      JSON.stringify({ 
        status: data.status,
        videoUrl: data.output?.video || null,
        progress: data.progress || 0
      }), 
      { 
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao verificar status';
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      { 
        status: 500, 
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  }
});