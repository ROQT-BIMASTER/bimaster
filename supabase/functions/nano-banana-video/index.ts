import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VideoRequest {
  type: 'text-to-video' | 'image-to-video' | 'ugc-style' | 'mockup-3d' | 'multi-scene';
  prompt: string;
  productName?: string;
  brandGuidelines?: {
    colors?: string[];
    style?: string;
    tone?: string;
  };
  imageBase64?: string;
  imageUrl?: string;
  scenes?: Array<{
    description: string;
    duration: number;
  }>;
  format?: '9:16' | '16:9' | '1:1';
  duration?: number;
  style?: 'professional' | 'ugc' | 'cinematic' | 'minimal' | 'energetic';
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

    const request: VideoRequest = await req.json();
    const { 
      type, 
      prompt, 
      productName, 
      brandGuidelines,
      imageBase64, 
      imageUrl,
      scenes,
      format = '9:16',
      duration = 5,
      style = 'professional'
    } = request;

    if (!prompt && !imageBase64 && !imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Prompt ou imagem é obrigatório' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Nano Banana Video - Gerando criativo:', { type, format, style, hasImage: !!(imageBase64 || imageUrl) });

    // Construir prompt otimizado para cada tipo
    let enhancedPrompt = '';
    
    switch (type) {
      case 'text-to-video':
        enhancedPrompt = buildTextToVideoPrompt(prompt, productName, brandGuidelines, format, style);
        break;
      case 'image-to-video':
        enhancedPrompt = buildImageToVideoPrompt(prompt, productName, format);
        break;
      case 'ugc-style':
        enhancedPrompt = buildUGCPrompt(prompt, productName);
        break;
      case 'mockup-3d':
        enhancedPrompt = buildMockup3DPrompt(prompt, productName, brandGuidelines);
        break;
      case 'multi-scene':
        enhancedPrompt = buildMultiScenePrompt(scenes || [], productName, brandGuidelines);
        break;
      default:
        enhancedPrompt = prompt;
    }

    // Preparar mensagens para a API
    const messages: any[] = [];
    
    if (imageBase64 || imageUrl) {
      // Modo image-to-video ou edição
      messages.push({
        role: "user",
        content: [
          { type: "text", text: enhancedPrompt },
          {
            type: "image_url",
            image_url: {
              url: imageBase64 ? `data:image/png;base64,${imageBase64}` : imageUrl
            }
          }
        ]
      });
    } else {
      // Modo text-to-video
      messages.push({
        role: "user",
        content: enhancedPrompt
      });
    }

    // Chamar Lovable AI Gateway com Gemini para geração de imagem
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages,
        modalities: ["image", "text"]
      }),
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
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao workspace.' }), 
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const errorText = await response.text();
      console.error('Erro Lovable AI:', response.status, errorText);
      throw new Error(`Erro na geração: ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0]?.message;
    
    // Extrair imagem gerada
    const generatedImage = choice?.images?.[0]?.image_url?.url;
    const textResponse = choice?.content || '';

    if (!generatedImage) {
      console.log('Resposta sem imagem:', data);
      return new Response(
        JSON.stringify({ 
          error: 'Não foi possível gerar a imagem. Tente reformular o prompt.',
          details: textResponse 
        }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Gerar roteiro e metadados
    const script = generateVideoScript(type, prompt, productName, scenes);

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: generatedImage,
        script,
        metadata: {
          type,
          format,
          style,
          duration,
          productName,
          brandGuidelines,
          generatedAt: new Date().toISOString()
        },
        message: textResponse
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro Nano Banana Video:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar vídeo';
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Funções auxiliares para construção de prompts

function buildTextToVideoPrompt(
  prompt: string, 
  productName?: string, 
  brandGuidelines?: any,
  format?: string,
  style?: string
): string {
  const styleGuides: Record<string, string> = {
    professional: 'clean, professional lighting, studio quality, high-end commercial feel',
    ugc: 'authentic, handheld camera feel, natural lighting, casual environment',
    cinematic: 'dramatic lighting, shallow depth of field, movie-like composition',
    minimal: 'clean white background, minimal props, focus on product',
    energetic: 'dynamic composition, vibrant colors, action-oriented'
  };

  const formatGuides: Record<string, string> = {
    '9:16': 'vertical format optimized for Instagram Reels and TikTok',
    '16:9': 'horizontal format for YouTube and web banners',
    '1:1': 'square format for Instagram feed posts'
  };

  let enhancedPrompt = `Create a stunning product visual for ${productName || 'the product'}.

${prompt}

Style: ${styleGuides[style || 'professional']}
Format: ${formatGuides[format || '9:16']}`;

  if (brandGuidelines?.colors?.length) {
    enhancedPrompt += `\nBrand colors: ${brandGuidelines.colors.join(', ')}`;
  }
  if (brandGuidelines?.style) {
    enhancedPrompt += `\nBrand style: ${brandGuidelines.style}`;
  }

  enhancedPrompt += `

IMPORTANT: 
- The product must be prominently visible and be the hero of the image
- Use high quality, photorealistic rendering
- Ensure proper composition for ${format || '9:16'} aspect ratio
- Make it suitable for social media advertising`;

  return enhancedPrompt;
}

function buildImageToVideoPrompt(prompt: string, productName?: string, format?: string): string {
  return `Animate and enhance this product image for ${productName || 'the product'}.

${prompt}

Requirements:
- Maintain the exact product appearance and branding
- Add subtle motion elements: floating particles, light rays, or product rotation
- Keep the product as the hero element
- Format: ${format || '9:16'} aspect ratio
- Make it look dynamic and eye-catching for social media ads
- Ultra high resolution, photorealistic quality`;
}

function buildUGCPrompt(prompt: string, productName?: string): string {
  return `Create an authentic User-Generated Content style image for ${productName || 'the product'}.

${prompt}

Style requirements:
- Natural, authentic lighting (like from a window or room light)
- Casual setting: home environment, desk, or lifestyle context
- Camera angle like taken from a smartphone
- The product should look like it's in someone's real life
- Add subtle lifestyle elements (coffee cup, plants, hands, etc.)
- Make it feel genuine and relatable, not overly polished
- Vertical 9:16 format perfect for TikTok and Reels`;
}

function buildMockup3DPrompt(prompt: string, productName?: string, brandGuidelines?: any): string {
  let enhancedPrompt = `Create a professional 3D product mockup for ${productName || 'the product'}.

${prompt}

Requirements:
- Studio-quality 3D rendering
- Clean gradient or solid background
- Professional lighting with soft shadows
- Show the product from an attractive angle
- Perfect for packaging validation and trade marketing`;

  if (brandGuidelines?.colors?.length) {
    enhancedPrompt += `\n- Use brand colors in the background/accents: ${brandGuidelines.colors.join(', ')}`;
  }

  return enhancedPrompt;
}

function buildMultiScenePrompt(
  scenes: Array<{ description: string; duration: number }>,
  productName?: string,
  brandGuidelines?: any
): string {
  const sceneDescriptions = scenes.map((scene, i) => 
    `Scene ${i + 1} (${scene.duration}s): ${scene.description}`
  ).join('\n');

  return `Create a key visual for a multi-scene video about ${productName || 'the product'}.

This is the hero frame that represents the overall campaign:

${sceneDescriptions}

Create one powerful image that captures the essence of this video concept.
Style: Cinematic, high-impact, suitable for video advertising
Format: 9:16 vertical for social media`;
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
  // Gerar roteiro básico baseado no tipo
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
