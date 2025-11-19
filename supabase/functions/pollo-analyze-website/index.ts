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
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL é obrigatória' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Analisando site:', url);

    // Fazer scraping básico do site
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erro ao acessar site: ${response.status}`);
    }

    const html = await response.text();
    
    // Extrair informações básicas do site
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const descMatch = html.match(/<meta\s+name="description"\s+content="(.*?)"/i);
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    
    const title = titleMatch ? titleMatch[1] : 'Sem título';
    const description = descMatch ? descMatch[1] : '';
    const h1 = h1Match ? h1Match[1].replace(/<[^>]*>/g, '') : '';

    // Criar análise para usar na geração de conteúdo
    const analysis = `Site: ${title}
${description ? `Descrição: ${description}` : ''}
${h1 ? `Título principal: ${h1}` : ''}

Baseado neste site, crie conteúdo visual relevante e profissional.`;

    return new Response(
      JSON.stringify({ 
        analysis,
        metadata: {
          title,
          description,
          h1,
          url
        }
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Erro ao analisar site:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao analisar site';
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});