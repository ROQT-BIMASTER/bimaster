import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-pro";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI não configurada" }), { status: 503, headers: jsonHeaders });
    }

    const { platform, username, display_name, influencer_id } = await req.json();
    if (!username || !platform) {
      return new Response(JSON.stringify({ error: "platform e username são obrigatórios" }), { status: 400, headers: jsonHeaders });
    }

    const searchName = display_name || username;
    const today = new Date().toISOString().split("T")[0];

    const systemPrompt = `Você é um analista de inteligência de reputação digital especializado em influenciadores e figuras públicas. Data de hoje: ${today}.

Sua tarefa é analisar a reputação de um influenciador/criador de conteúdo usando todo seu conhecimento disponível.

IMPORTANTE:
- Use seu conhecimento mais atualizado disponível sobre esta pessoa
- Priorize eventos dos últimos 6 meses
- Inclua notícias recentes, polêmicas, controvérsias, processos judiciais
- Inclua parcerias com marcas, declarações controversas, cancelamentos
- Inclua reconhecimentos positivos, prêmios, ações sociais
- Se o influenciador não é amplamente conhecido, analise baseado no nicho e plataforma

Retorne SEMPRE um JSON estruturado via tool call. Se não encontrar informações suficientes, retorne scores neutros e indique isso no summary.`;

    const userPrompt = `Analise a reputação do influenciador/criador de conteúdo:

Nome: ${searchName}
Username: @${username}
Plataforma: ${platform}
Data da análise: ${today}

Forneça uma análise completa e atualizada da reputação, considerando os últimos 12 meses com mais peso. Inclua eventos históricos relevantes que ainda impactam a imagem.`;

    const response = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
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
            name: "return_reputation_analysis",
            description: "Return the reputation analysis as structured JSON",
            parameters: {
              type: "object",
              properties: {
                result: {
                  type: "object",
                  properties: {
                    reputation_score: { type: "number", description: "0-100, where 100 is excellent reputation" },
                    brand_safety_score: { type: "number", description: "0-100, where 100 is completely safe for brands" },
                    brand_safety_level: { type: "string", enum: ["safe", "low_risk", "medium_risk", "high_risk", "critical"] },
                    crisis_active: { type: "boolean", description: "Whether there is an active reputation crisis right now" },
                    summary: { type: "string", description: "Brief summary of the influencer's reputation in Portuguese" },
                    news_timeline: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          date: { type: "string", description: "YYYY-MM or approximate date" },
                          sentiment: { type: "string", enum: ["positive", "negative", "neutral"] },
                          category: { type: "string", enum: ["news", "controversy", "lawsuit", "award", "partnership", "social_action", "statement"] },
                          description: { type: "string" },
                          source: { type: "string", description: "Name of news source if known" },
                          url: { type: "string", description: "URL if available, otherwise empty string" },
                          severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
                        },
                        required: ["title", "date", "sentiment", "category", "description"],
                      },
                    },
                    controversies: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          description: { type: "string" },
                          severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
                          status: { type: "string", enum: ["resolved", "ongoing", "unknown"] },
                          date: { type: "string" },
                          impact_on_brands: { type: "string" },
                        },
                        required: ["title", "description", "severity", "status"],
                      },
                    },
                    media_sentiment: {
                      type: "object",
                      properties: {
                        positive_pct: { type: "number" },
                        neutral_pct: { type: "number" },
                        negative_pct: { type: "number" },
                      },
                    },
                    risk_factors: {
                      type: "array",
                      items: { type: "string" },
                      description: "List of specific risk factors for brands",
                    },
                    positive_highlights: {
                      type: "array",
                      items: { type: "string" },
                      description: "List of positive reputation highlights",
                    },
                    strategic_recommendation: { type: "string", description: "Strategic recommendation for brands considering partnership, in Portuguese" },
                  },
                  required: ["reputation_score", "brand_safety_score", "brand_safety_level", "crisis_active", "summary", "news_timeline", "controversies", "media_sentiment", "strategic_recommendation"],
                },
              },
              required: ["result"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_reputation_analysis" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido, tente novamente em breve" }), { status: 429, headers: jsonHeaders });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos em Settings > Workspace > Usage" }), { status: 402, headers: jsonHeaders });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    let result;
    if (toolCall) {
      const parsed = JSON.parse(toolCall.function.arguments);
      result = parsed.result;
    } else {
      const content = data.choices?.[0]?.message?.content || "{}";
      try { result = JSON.parse(content); } catch { result = { raw: content }; }
    }

    result.researched_at = new Date().toISOString();
    result.platform = platform;
    result.username = username;

    // Persist to influencer_analyses if influencer_id provided
    if (influencer_id) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabaseAdmin.from("influencer_analyses").insert({
          influencer_id,
          analysis_type: "reputation",
          result,
          score: result.brand_safety_score ?? null,
        });
      } catch (dbErr) {
        console.error("Failed to persist reputation analysis:", dbErr);
      }
    }

    return new Response(JSON.stringify({ data: result }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error("research-influencer-reputation error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: jsonHeaders });
  }
});