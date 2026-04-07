import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, data } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompts: Record<string, string> = {
      generate_persona: `Você é um estrategista de marketing digital. Com base nas informações do cliente abaixo, crie uma persona detalhada do comprador ideal. Inclua: nome fictício, idade, profissão, renda, dores, motivações, canais preferidos, comportamento de compra, objeções comuns e como a marca pode se conectar. Retorne em JSON com os campos: name, age, profession, income, pains (array), motivations (array), channels (array), buying_behavior, objections (array), connection_strategy.\n\nDados do cliente: ${JSON.stringify(data)}`,
      
      generate_swot: `Você é um consultor de estratégia. Faça uma análise SWOT completa para o cliente/marca descrito abaixo. Retorne em JSON com os campos: strengths (array), weaknesses (array), opportunities (array), threats (array), cada item com "title" e "description". Adicione também "recommendations" (array de strings).\n\nDados: ${JSON.stringify(data)}`,
      
      suggest_content: `Você é um planejador de conteúdo digital. Com base no segmento, personas e etapa do funil informados, sugira 5 ideias de conteúdo. Para cada ideia, inclua: titulo, formato (post/reel/story/blog/email/video), plataforma, descricao, etapa_funil, e justificativa. Retorne como JSON array.\n\nDados: ${JSON.stringify(data)}`,
      
      analyze_competitor: `Você é um analista de inteligência competitiva. Analise o concorrente descrito e gere insights sobre: posicionamento, pontos fortes, pontos fracos, oportunidades de diferenciação, e recomendações estratégicas. Retorne em JSON com campos: positioning, strengths (array), weaknesses (array), differentiation_opportunities (array), recommendations (array).\n\nDados: ${JSON.stringify(data)}`,
      
      generate_briefing: `Você é um diretor criativo de agência. Crie um briefing profissional completo de campanha com base nos dados fornecidos. O briefing deve incluir: contexto, objetivo, público-alvo, mensagem chave, tom de voz, canais recomendados, cronograma sugerido, KPIs esperados e referências criativas. Formate como texto profissional em markdown.\n\nDados: ${JSON.stringify(data)}`,
      
      generate_report: `Você é um analista de performance de marketing digital. Com base nas métricas fornecidas, gere um relatório executivo mensal. Inclua: resumo executivo, análise de cada canal, comparação com período anterior, destaques positivos, pontos de atenção, e recomendações para o próximo período. Formate em markdown profissional.\n\nDados: ${JSON.stringify(data)}`,
      
      generate_voice: `Você é um especialista em branding e tom de voz. Com base nas informações do cliente, defina o tom de voz da marca. Inclua: personalidade (formal/informal, técnico/acessível, etc), adjetivos que definem a marca (5), palavras a usar, palavras a evitar, 3 exemplos de posts em diferentes contextos. Retorne em JSON com campos: personality, adjectives (array), words_to_use (array), words_to_avoid (array), examples (array com context e text).\n\nDados: ${JSON.stringify(data)}`,
    };

    const systemPrompt = prompts[action];
    if (!systemPrompt) {
      return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um especialista em marketing digital e estratégia para agências. Sempre responda em português brasileiro." },
          { role: "user", content: systemPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Configurações > Workspace > Uso." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("agency-strategy-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
