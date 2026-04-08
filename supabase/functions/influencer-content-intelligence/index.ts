import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, patterns, theme, objective, platform, tone } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Load company profile
    const { data: companyProfile } = await supabase
      .from("influencer_company_profile")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const companyCtx = companyProfile
      ? `Empresa: ${companyProfile.company_name || "N/A"}, Segmento: ${companyProfile.segment || "N/A"}, Público-alvo: ${companyProfile.target_audience || "N/A"}, Tom de voz: ${companyProfile.brand_voice || "N/A"}, Objetivos: ${companyProfile.objectives || "N/A"}, Valores: ${companyProfile.values || "N/A"}`
      : "Perfil da empresa não configurado.";

    if (action === "analyze_patterns") {
      // Load all posts from user's influencers
      const { data: influencers } = await supabase
        .from("influencers")
        .select("id, username, platform")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (!influencers || influencers.length === 0) {
        return new Response(
          JSON.stringify({ error: "Nenhum influenciador cadastrado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const ids = influencers.map((i) => i.id);
      const { data: posts } = await supabase
        .from("influencer_posts")
        .select("post_type, likes, comments, shares, engagement_rate, caption, posted_at, influencer_id, hashtags")
        .in("influencer_id", ids)
        .order("engagement_rate", { ascending: false })
        .limit(500);

      if (!posts || posts.length === 0) {
        return new Response(
          JSON.stringify({ error: "Nenhum post coletado. Colete conteúdo dos influenciadores primeiro." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build summary for AI
      const postsSummary = posts.slice(0, 200).map((p) => ({
        type: p.post_type,
        likes: p.likes,
        comments: p.comments,
        shares: p.shares,
        engagement: p.engagement_rate,
        hashtags: p.hashtags,
        caption_length: p.caption?.length || 0,
        posted_at: p.posted_at,
      }));

      const aiResponse = await callAI(LOVABLE_API_KEY, {
        messages: [
          {
            role: "system",
            content: `Você é um analista de marketing digital especializado em conteúdo de redes sociais. Analise os dados de posts de influenciadores e identifique padrões de performance. ${companyCtx}`,
          },
          {
            role: "user",
            content: `Analise estes ${posts.length} posts de ${influencers.length} influenciadores e identifique padrões:\n\n${JSON.stringify(postsSummary)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_patterns",
              description: "Report content performance patterns",
              parameters: {
                type: "object",
                properties: {
                  top_formats: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        format: { type: "string" },
                        avg_engagement: { type: "number" },
                        percentage: { type: "number" },
                      },
                      required: ["format", "avg_engagement", "percentage"],
                    },
                  },
                  best_times: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        day: { type: "string" },
                        time_range: { type: "string" },
                        engagement_boost: { type: "string" },
                      },
                      required: ["day", "time_range"],
                    },
                  },
                  trending_themes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        theme: { type: "string" },
                        examples: { type: "number" },
                        avg_engagement: { type: "number" },
                      },
                      required: ["theme", "examples"],
                    },
                  },
                  top_hashtags: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        hashtag: { type: "string" },
                        frequency: { type: "number" },
                        avg_engagement: { type: "number" },
                      },
                      required: ["hashtag", "frequency"],
                    },
                  },
                  caption_insights: {
                    type: "object",
                    properties: {
                      optimal_length: { type: "string" },
                      best_tone: { type: "string" },
                      cta_usage: { type: "string" },
                    },
                  },
                  summary: { type: "string" },
                },
                required: ["top_formats", "best_times", "trending_themes", "top_hashtags", "summary"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_patterns" } },
      });

      const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
      const result = toolCall ? JSON.parse(toolCall.function.arguments) : null;

      return new Response(JSON.stringify({ data: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "suggest_content") {
      const aiResponse = await callAI(LOVABLE_API_KEY, {
        messages: [
          {
            role: "system",
            content: `Você é um estrategista de conteúdo digital. Com base nos padrões de performance dos influenciadores monitorados e no perfil da empresa, sugira ideias de conteúdo otimizadas. ${companyCtx}`,
          },
          {
            role: "user",
            content: `Com base nestes padrões de performance identificados:\n${JSON.stringify(patterns)}\n\nGere 5 sugestões de conteúdo para a empresa.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_content",
              description: "Suggest optimized content ideas",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        format: { type: "string" },
                        platform: { type: "string" },
                        description: { type: "string" },
                        justification: { type: "string" },
                        hashtags: { type: "array", items: { type: "string" } },
                      },
                      required: ["title", "format", "platform", "description", "justification", "hashtags"],
                    },
                  },
                },
                required: ["suggestions"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_content" } },
      });

      const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
      const result = toolCall ? JSON.parse(toolCall.function.arguments) : null;

      return new Response(JSON.stringify({ data: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate_post") {
      const aiResponse = await callAI(LOVABLE_API_KEY, {
        messages: [
          {
            role: "system",
            content: `Você é um copywriter especialista em redes sociais. Crie postagens profissionais e otimizadas para engajamento. ${companyCtx}. Data atual: ${new Date().toISOString().substring(0, 10)}.`,
          },
          {
            role: "user",
            content: `Crie uma postagem com estas especificações:\n- Tema: ${theme}\n- Objetivo: ${objective}\n- Plataforma: ${platform}\n- Tom: ${tone}\n\nPatterns de referência: ${patterns ? JSON.stringify(patterns) : "N/A"}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_post",
              description: "Generate a complete social media post",
              parameters: {
                type: "object",
                properties: {
                  main_text: { type: "string" },
                  caption_variations: {
                    type: "array",
                    items: { type: "string" },
                  },
                  hashtags: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        tag: { type: "string" },
                        relevance: { type: "number" },
                      },
                      required: ["tag", "relevance"],
                    },
                  },
                  recommended_format: { type: "string" },
                  best_time: { type: "string" },
                  tips: { type: "string" },
                },
                required: ["main_text", "caption_variations", "hashtags", "recommended_format", "best_time"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_post" } },
      });

      const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
      const result = toolCall ? JSON.parse(toolCall.function.arguments) : null;

      return new Response(JSON.stringify({ data: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("content-intelligence error:", err);
    const status = err instanceof Error && err.message.includes("429") ? 429 : 500;
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function callAI(apiKey: string, body: Record<string, unknown>) {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", ...body }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("AI error:", resp.status, text);
    throw new Error(`AI error ${resp.status}`);
  }

  return resp.json();
}
