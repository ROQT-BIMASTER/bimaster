import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


interface VideoRequest {
  type: 'text-to-video' | 'image-to-video' | 'ugc-style' | 'mockup-3d' | 'multi-scene';
  prompt: string;
  productName?: string;
  brandGuidelines?: {
    colors?: string[];
    style?: string;
    tone?: string;
  };
  imageUrl?: string;
  scenes?: Array<{
    description: string;
    duration: number;
  }>;
  format?: '9:16' | '16:9' | '1:1';
  duration?: number;
  style?: 'professional' | 'ugc' | 'cinematic' | 'minimal' | 'energetic';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const request: VideoRequest = await req.json();
    const { 
      type, 
      prompt, 
      productName, 
      brandGuidelines,
      imageUrl,
      scenes,
      format = '9:16',
      duration = 5,
      style = 'professional'
    } = request;

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt é obrigatório' }), 
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    console.log('Nano Banana Video - Gerando vídeo:', { type, format, style, duration, hasImage: !!imageUrl });

    // Construir prompt otimizado para vídeo
    const videoPrompt = buildVideoPrompt(type, prompt, productName, brandGuidelines, format, style, scenes);
    
    // Gerar roteiro e metadados
    const script = generateVideoScript(type, prompt, productName, scenes);

    // Retornar os dados para geração do vídeo no frontend
    // O vídeo será gerado usando a ferramenta videogen do Lovable
    return new Response(
      JSON.stringify({
        success: true,
        videoPrompt,
        script,
        config: {
          aspectRatio: format,
          duration,
          cameraFixed: style === 'minimal' || style === 'professional'
        },
        metadata: {
          type,
          format,
          style,
          duration,
          productName,
          brandGuidelines,
          generatedAt: new Date().toISOString()
        },
        startingFrame: imageUrl || null
      }), 
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro Nano Banana Video:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao processar solicitação';
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});

function buildVideoPrompt(
  type: string,
  prompt: string,
  productName?: string,
  brandGuidelines?: any,
  format?: string,
  style?: string,
  scenes?: Array<{ description: string; duration: number }>
): string {
  const styleGuides: Record<string, string> = {
    professional: 'professional studio lighting, clean commercial aesthetic, smooth camera movement',
    ugc: 'authentic handheld camera feel, natural daylight, casual environment, slightly shaky for authenticity',
    cinematic: 'dramatic lighting, slow motion, cinematic color grading, shallow depth of field',
    minimal: 'clean white background, minimal movement, focus on product details, stable camera',
    energetic: 'dynamic camera movements, fast cuts, vibrant colors, high energy motion'
  };

  const formatGuides: Record<string, string> = {
    '9:16': 'vertical video for Instagram Reels and TikTok',
    '16:9': 'horizontal widescreen for YouTube',
    '1:1': 'square format for Instagram feed'
  };

  let videoPrompt = '';

  switch (type) {
    case 'text-to-video':
      videoPrompt = `Product video showcasing ${productName || 'the product'}. ${prompt}. ${styleGuides[style || 'professional']}. ${formatGuides[format || '9:16']}. The product should be the hero of the video, prominently featured with professional presentation.`;
      break;
      
    case 'image-to-video':
      videoPrompt = `Animate this product image with subtle motion: gentle rotation, floating particles, light rays, or product reveal. ${prompt}. Maintain exact product appearance. ${styleGuides[style || 'professional']}.`;
      break;
      
    case 'ugc-style':
      videoPrompt = `User-generated content style video of ${productName || 'the product'}. ${prompt}. Authentic feel like someone filming with their phone. Natural lighting, casual setting, relatable environment. Show genuine product interaction.`;
      break;
      
    case 'mockup-3d':
      videoPrompt = `3D product mockup animation for ${productName || 'the product'}. ${prompt}. Slow 360-degree rotation, studio lighting, clean gradient background, professional packaging visualization. Perfect for trade marketing.`;
      break;
      
    case 'multi-scene':
      const sceneDescriptions = scenes?.map((s, i) => 
        `Scene ${i + 1} (${s.duration}s): ${s.description}`
      ).join('. ') || prompt;
      videoPrompt = `Multi-scene product video for ${productName || 'the product'}. ${sceneDescriptions}. Smooth transitions between scenes. ${styleGuides[style || 'cinematic']}.`;
      break;
      
    default:
      videoPrompt = prompt;
  }

  if (brandGuidelines?.colors?.length) {
    videoPrompt += ` Use brand colors: ${brandGuidelines.colors.join(', ')}.`;
  }
  if (brandGuidelines?.style) {
    videoPrompt += ` Brand style: ${brandGuidelines.style}.`;
  }

  videoPrompt += ' Ultra high resolution, professional video quality.';

  return videoPrompt;
}

function generateVideoScript(
  type: string,
  prompt: string,
  productName?: string,
  scenes?: Array<{ description: string; duration: number }>
): {
  hook: string;
  action: string;
  benefit: string;
  cta: string;
  fullScript: string;
} {
  const defaultScripts: Record<string, any> = {
    'text-to-video': {
      hook: `Descubra ${productName || 'este produto incrível'}!`,
      action: 'Veja como ele transforma sua rotina',
      benefit: 'Qualidade premium que você merece',
      cta: 'Compre agora e aproveite!'
    },
    'image-to-video': {
      hook: `${productName || 'O produto'} em ação!`,
      action: 'Design sofisticado, resultados reais',
      benefit: 'Feito para quem exige o melhor',
      cta: 'Garanta o seu hoje!'
    },
    'ugc-style': {
      hook: `Gente, olha isso! ${productName || 'Esse produto'}...`,
      action: 'Eu testei e simplesmente amei',
      benefit: 'Mudou completamente minha experiência',
      cta: 'Corre que vale muito a pena!'
    },
    'mockup-3d': {
      hook: `Apresentamos: ${productName || 'Novo lançamento'}`,
      action: 'Design inovador, qualidade incomparável',
      benefit: 'A evolução que você esperava',
      cta: 'Disponível agora!'
    },
    'multi-scene': {
      hook: scenes?.[0]?.description || 'Uma experiência única',
      action: scenes?.[1]?.description || 'Transformação completa',
      benefit: scenes?.[2]?.description || 'Resultados surpreendentes',
      cta: 'Não perca essa oportunidade!'
    }
  };

  const script = defaultScripts[type] || defaultScripts['text-to-video'];
  
  return {
    ...script,
    fullScript: `🎬 ROTEIRO DE VÍDEO - ${productName || 'PRODUTO'}

HOOK (0-3s): ${script.hook}

AÇÃO (3-8s): ${script.action}

BENEFÍCIO (8-12s): ${script.benefit}

CTA (12-15s): ${script.cta}

---
Prompt original: ${prompt}`
  };
}
