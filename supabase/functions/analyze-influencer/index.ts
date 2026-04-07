import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-3-flash-preview";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: jsonHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI não configurada" }), { status: 503, headers: jsonHeaders });
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: jsonHeaders });
    }

    const body = await req.json();
    const { influencer_id, analysis_type, brand_context } = body;

    if (!influencer_id || !analysis_type) {
      return new Response(JSON.stringify({ error: "influencer_id e analysis_type são obrigatórios" }), { status: 400, headers: jsonHeaders });
    }

    // Load influencer data
    const { data: influencer, error: infError } = await supabase
      .from("influencers")
      .select("*")
      .eq("id", influencer_id)
      .eq("user_id", user.id)
      .single();

    if (infError || !influencer) {
      return new Response(JSON.stringify({ error: "Influenciador não encontrado" }), { status: 404, headers: jsonHeaders });
    }

    // Load posts
    const { data: posts } = await supabase
      .from("influencer_posts")
      .select("*")
      .eq("influencer_id", influencer_id)
      .order("posted_at", { ascending: false })
      .limit(50);

    // Load comments
    const postIds = (posts || []).map((p: any) => p.id);
    let comments: any[] = [];
    if (postIds.length > 0) {
      const { data: c } = await supabase
        .from("influencer_comments")
        .select("*")
        .in("post_id", postIds)
        .limit(200);
      comments = c || [];
    }

    // Load previous analyses
    const { data: prevAnalyses } = await supabase
      .from("influencer_analyses")
      .select("*")
      .eq("influencer_id", influencer_id)
      .order("created_at", { ascending: false })
      .limit(5);

    let result: any;

    switch (analysis_type) {
      case "content_analysis": {
        result = await analyzeContent(lovableKey, influencer, posts || []);
        break;
      }
      case "sentiment_analysis": {
        result = await analyzeSentiment(lovableKey, influencer, posts || [], comments);
        break;
      }
      case "fraud_detection": {
        result = await detectFraud(lovableKey, influencer, posts || [], comments);
        // Update fraud_score on influencer
        if (result.fraud_score !== undefined) {
          await supabase
            .from("influencers")
            .update({ fraud_score: result.fraud_score })
            .eq("id", influencer_id);
        }
        break;
      }
      case "full_360": {
        // Run content, sentiment, fraud, and reputation in parallel
        const [content, sentiment, fraud, reputationResult] = await Promise.all([
          analyzeContent(lovableKey, influencer, posts || []),
          analyzeSentiment(lovableKey, influencer, posts || [], comments),
          detectFraud(lovableKey, influencer, posts || [], comments),
          researchReputation(lovableKey, influencer).catch(err => {
            console.error("Reputation research failed (non-blocking):", err);
            return null;
          }),
        ]);
        if (fraud.fraud_score !== undefined) {
          await supabase
            .from("influencers")
            .update({ fraud_score: fraud.fraud_score })
            .eq("id", influencer_id);
        }
        result = {
          content_analysis: content,
          sentiment_analysis: sentiment,
          fraud_detection: fraud,
          reputation_analysis: reputationResult,
          generated_at: new Date().toISOString(),
        };
        break;
      }
      case "recommendation": {
        // Load all influencers for comparison
        const { data: allInfluencers } = await supabase
          .from("influencers")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "active");
        result = await recommendInfluencers(lovableKey, allInfluencers || [], brand_context || {});
        break;
      }
      default:
        return new Response(JSON.stringify({ error: "analysis_type inválido" }), { status: 400, headers: jsonHeaders });
    }

    // Save analysis
    await supabase.from("influencer_analyses").insert({
      influencer_id,
      user_id: user.id,
      analysis_type,
      result,
      ai_model: AI_MODEL,
    });

    return new Response(JSON.stringify({ data: result }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error("analyze-influencer error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: jsonHeaders });
  }
});

async function callAI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<any> {
  const response = await fetch(AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_analysis",
          description: "Return the analysis result as structured JSON",
          parameters: {
            type: "object",
            properties: {
              result: { type: "object" }
            },
            required: ["result"],
          }
        }
      }],
      tool_choice: { type: "function", function: { name: "return_analysis" } },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI error:", response.status, errText);
    throw new Error(`AI error: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall) {
    const parsed = JSON.parse(toolCall.function.arguments);
    return parsed.result;
  }
  // Fallback: parse content
  const content = data.choices?.[0]?.message?.content || "{}";
  try { return JSON.parse(content); } catch { return { raw: content }; }
}

async function analyzeContent(apiKey: string, influencer: any, posts: any[]): Promise<any> {
  const system = `Você é um analista de marketing digital especialista em influenciadores. Analise o conteúdo postado por um influenciador e retorne insights estruturados em JSON.

O resultado DEVE ter esta estrutura:
{
  "themes": [{"name": "string", "frequency": "high/medium/low", "examples": ["string"]}],
  "tone": "string (ex: informal, profissional, humorístico)",
  "content_quality": "high/medium/low",
  "posting_frequency": "string (ex: 3x por semana)",
  "sponsored_ratio": "number (0-100, % de posts patrocinados)",
  "top_performing_content": [{"caption_summary": "string", "likes": "number", "engagement": "string"}],
  "recommendations": ["string"],
  "overall_score": "number (0-100)"
}`;

  const postSummaries = posts.slice(0, 30).map(p => ({
    caption: (p.caption || "").substring(0, 200),
    likes: p.likes,
    comments: p.comments_count,
    shares: p.shares,
    type: p.post_type,
    date: p.posted_at,
  }));

  const user = `Influenciador: @${influencer.username} (${influencer.platform})
Seguidores: ${influencer.followers_count}
Engajamento médio: ${influencer.engagement_rate}%
Média de likes: ${influencer.avg_likes}
Média de comentários: ${influencer.avg_comments}

Posts recentes (${postSummaries.length}):
${JSON.stringify(postSummaries, null, 2)}`;

  return callAI(apiKey, system, user);
}

async function analyzeSentiment(apiKey: string, influencer: any, posts: any[], comments: any[]): Promise<any> {
  const system = `Você é um analista de sentimento especializado em redes sociais. Analise os comentários de um influenciador e retorne insights sobre o sentimento da audiência.

O resultado DEVE ter esta estrutura:
{
  "overall_sentiment": "positive/negative/neutral/mixed",
  "sentiment_distribution": {"positive": "number%", "negative": "number%", "neutral": "number%"},
  "spam_percentage": "number (0-100)",
  "key_positive_themes": ["string"],
  "key_negative_themes": ["string"],
  "audience_engagement_quality": "high/medium/low",
  "notable_comments": [{"text": "string", "sentiment": "string", "reason": "string"}],
  "bot_activity_indicators": ["string"],
  "overall_score": "number (0-100)"
}`;

  const commentSamples = comments.slice(0, 100).map(c => ({
    author: c.author_username,
    text: (c.comment_text || "").substring(0, 150),
  }));

  const user = `Influenciador: @${influencer.username} (${influencer.platform})
Total de posts analisados: ${posts.length}
Total de comentários: ${comments.length}

Amostra de comentários (${commentSamples.length}):
${JSON.stringify(commentSamples, null, 2)}`;

  return callAI(apiKey, system, user);
}

async function detectFraud(apiKey: string, influencer: any, posts: any[], comments: any[]): Promise<any> {
  const system = `Você é um especialista em detecção de fraude em redes sociais. Analise os dados de um influenciador para identificar seguidores falsos, engajamento artificial e outros indicadores de fraude.

O resultado DEVE ter esta estrutura:
{
  "fraud_score": "number (0-100, onde 100 = totalmente autêntico)",
  "risk_level": "low/medium/high/critical",
  "red_flags": [{"indicator": "string", "severity": "high/medium/low", "description": "string"}],
  "positive_signals": [{"indicator": "string", "description": "string"}],
  "followers_quality": {
    "estimated_real": "number%",
    "estimated_bots": "number%",
    "estimated_inactive": "number%"
  },
  "engagement_authenticity": {
    "score": "number (0-100)",
    "suspicious_patterns": ["string"]
  },
  "growth_analysis": "string",
  "recommendations": ["string"]
}`;

  const avgLikesRatio = influencer.followers_count > 0
    ? (influencer.avg_likes / influencer.followers_count * 100).toFixed(2)
    : 0;

  const commentPatterns = comments.slice(0, 50).map(c => ({
    text: (c.comment_text || "").substring(0, 100),
    author: c.author_username,
  }));

  const user = `Influenciador: @${influencer.username} (${influencer.platform})
Seguidores: ${influencer.followers_count}
Taxa de engajamento: ${influencer.engagement_rate}%
Média de likes: ${influencer.avg_likes} (${avgLikesRatio}% dos seguidores)
Média de comentários: ${influencer.avg_comments}
Fraud score atual: ${influencer.fraud_score ?? "não calculado"}

Posts analisados: ${posts.length}
Comentários analisados: ${comments.length}
Amostra de comentários:
${JSON.stringify(commentPatterns, null, 2)}`;

  return callAI(apiKey, system, user);
}

async function recommendInfluencers(apiKey: string, influencers: any[], brandContext: any): Promise<any> {
  const system = `Você é um consultor estratégico de marketing de influência. Compare os influenciadores monitorados e recomende os melhores para a marca/campanha descrita.

O resultado DEVE ter esta estrutura:
{
  "rankings": [
    {
      "influencer_id": "string",
      "username": "string",
      "platform": "string",
      "compatibility_score": "number (0-100)",
      "pros": ["string"],
      "cons": ["string"],
      "estimated_cpm": "string",
      "best_for": "string"
    }
  ],
  "strategy_recommendation": "string",
  "budget_suggestion": "string",
  "campaign_tips": ["string"]
}`;

  const infSummaries = influencers.map(i => ({
    id: i.id,
    username: i.username,
    platform: i.platform,
    followers: i.followers_count,
    engagement: i.engagement_rate,
    avg_likes: i.avg_likes,
    avg_comments: i.avg_comments,
    fraud_score: i.fraud_score,
    notes: i.notes,
  }));

  const user = `Marca/Campanha:
Nicho: ${brandContext.niche || "não especificado"}
Público-alvo: ${brandContext.target_audience || "não especificado"}
Orçamento: ${brandContext.budget || "não especificado"}
Objetivo: ${brandContext.objective || "não especificado"}
Descrição: ${brandContext.description || "não especificado"}

Influenciadores monitorados (${infSummaries.length}):
${JSON.stringify(infSummaries, null, 2)}`;

  return callAI(apiKey, system, user);
}
