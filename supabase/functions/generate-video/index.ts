import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VideoGenerationRequest {
  prompt: string;
  aspectRatio?: string;
  duration?: number;
  startingFrame?: string;
  resolution?: string;
  cameraFixed?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const request: VideoGenerationRequest = await req.json();
    const { 
      prompt, 
      aspectRatio = '9:16', 
      duration = 5,
      startingFrame,
      resolution = '1080p',
      cameraFixed = false
    } = request;

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt é obrigatório' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Gerando vídeo:', { prompt: prompt.substring(0, 100), aspectRatio, duration, hasStartingFrame: !!startingFrame });

    // Preparar request para a API de vídeo
    const videoRequest: any = {
      prompt,
      aspect_ratio: aspectRatio,
      duration,
      resolution,
      camera_fixed: cameraFixed
    };

    // Se tiver imagem inicial, adicionar ao request
    if (startingFrame) {
      videoRequest.starting_frame = startingFrame;
    }

    // Chamar API de geração de vídeo do Lovable
    const response = await fetch("https://ai.gateway.lovable.dev/v1/videos/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(videoRequest),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }), 
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao workspace Lovable.' }), 
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const errorText = await response.text();
      console.error('Erro API de vídeo:', response.status, errorText);
      
      // Tentar extrair mensagem de erro
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.error?.message || errorJson.message || `Erro na geração: ${response.status}`);
      } catch {
        throw new Error(`Erro na geração de vídeo: ${response.status}`);
      }
    }

    const data = await response.json();
    console.log('Resposta da API de vídeo:', JSON.stringify(data).substring(0, 500));

    // Extrair URL do vídeo gerado
    const videoUrl = data.data?.[0]?.url || data.video_url || data.url;

    if (!videoUrl) {
      console.log('Resposta completa:', data);
      return new Response(
        JSON.stringify({ 
          error: 'Não foi possível obter URL do vídeo gerado',
          details: data 
        }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl,
        metadata: {
          prompt: prompt.substring(0, 200),
          aspectRatio,
          duration,
          resolution,
          generatedAt: new Date().toISOString()
        }
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao gerar vídeo:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar vídeo';
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
