import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const headers = getCorsHeaders(req);
  const jsonHeaders = { ...headers, "Content-Type": "application/json" };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: jsonHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI não configurada" }), { status: 503, headers: jsonHeaders });
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: jsonHeaders });
    }

    const body = await req.json();
    const { action } = body;

    // Load company profile
    const { data: companyProfile } = await supabase
      .from("influencer_company_profile")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    // Load influencers
    const { data: influencers } = await supabase
      .from("influencers")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("followers_count", { ascending: false });

    const infList = influencers || [];

    if (action === "calculate_scores") {
      const scores = calculateScores(infList);
      for (const s of scores) {
        await supabase
          .from("influencers")
          .update({
            composite_score: s.composite_score,
            rank_position: s.rank_position,
            last_analyzed_at: new Date().toISOString(),
          })
          .eq("id", s.id);
      }
      return new Response(JSON.stringify({ data: { updated: scores.length, scores } }), { status: 200, headers: jsonHeaders });
    }

    if (action === "analyze_opportunities" || action === "auto_monitor") {
      if (infList.length === 0) {
        return new Response(JSON.stringify({ error: "Nenhum influenciador cadastrado" }), { status: 400, headers: jsonHeaders });
      }

      // Calculate scores
      const scores = calculateScores(infList);
      for (const s of scores) {
        await supabase
          .from("influencers")
          .update({
            composite_score: s.composite_score,
            rank_position: s.rank_position,
            last_analyzed_at: new Date().toISOString(),
          })
          .eq("id", s.id);
      }

      // Generate AI opportunities
      const opportunities = await generateOpportunities(lovableKey, infList, scores, companyProfile);

      // Update opportunity_score on influencers
      if (opportunities.top_opportunities) {
        for (const opp of opportunities.top_opportunities) {
          const inf = infList.find(i => i.username === opp.username);
          if (inf) {
            await supabase
              .from("influencers")
              .update({ opportunity_score: opp.score })
              .eq("id", inf.id);
          }
        }
      }

      // Persist opportunities to DB
      const now = new Date().toISOString();
      const records: any[] = [];

      // Opportunities
      for (const opp of (opportunities.top_opportunities || [])) {
        const inf = infList.find(i => i.username === opp.username);
        records.push({
          user_id: user.id,
          influencer_id: inf?.id || null,
          type: "opportunity",
          title: `@${opp.username} (${opp.platform})`,
          description: opp.reason,
          score: opp.score,
          status: "new",
          generated_at: now,
        });
      }

      // Alerts
      for (const alert of (opportunities.alerts || [])) {
        const inf = infList.find(i => i.username === alert.username);
        records.push({
          user_id: user.id,
          influencer_id: inf?.id || null,
          type: "alert",
          title: `@${alert.username}`,
          description: alert.message,
          alert_type: alert.type,
          status: "new",
          generated_at: now,
        });
      }

      // Trends
      for (const trend of (opportunities.trends || [])) {
        records.push({
          user_id: user.id,
          type: "trend",
          title: trend,
          status: "new",
          generated_at: now,
        });
      }

      // Actions
      for (const act of (opportunities.suggested_actions || [])) {
        records.push({
          user_id: user.id,
          type: "action",
          title: act,
          status: "new",
          generated_at: now,
        });
      }

      if (records.length > 0) {
        // Use admin client to bypass RLS for insert (since user_id is set explicitly)
        await supabaseAdmin.from("influencer_opportunities").insert(records);
      }

      // Update last_autopilot_run
      if (companyProfile) {
        await supabase
          .from("influencer_company_profile")
          .update({ last_autopilot_run: now })
          .eq("user_id", user.id);
      }

      return new Response(JSON.stringify({ data: { ...opportunities, persisted: records.length } }), { status: 200, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ error: "action inválida. Use: calculate_scores, analyze_opportunities, auto_monitor" }), { status: 400, headers: jsonHeaders });

  } catch (error) {
    console.error("influencer-autopilot error:", error);
    const headers2 = getCorsHeaders(req);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }), {
      status: 500,
      headers: { ...headers2, "Content-Type": "application/json" },
    });
  }
});

interface ScoredInfluencer {
  id: string;
  composite_score: number;
  rank_position: number;
  engagement_score: number;
  authenticity_score: number;
  reach_score: number;
}

function calculateScores(influencers: any[]): ScoredInfluencer[] {
  const scored = influencers.map(inf => {
    const benchmarks: Record<string, number> = { instagram: 3.0, tiktok: 5.0, youtube: 2.0, twitter: 1.5, facebook: 1.0, linkedin: 2.0 };
    const benchmark = benchmarks[inf.platform] || 2.0;
    const engRate = Number(inf.engagement_rate) || 0;
    const engagementScore = Math.min(100, (engRate / benchmark) * 50 + 20);
    const authenticityScore = inf.fraud_score != null ? Number(inf.fraud_score) : 50;
    const brandSafetyScore = authenticityScore * 0.8 + 15;
    const followers = inf.followers_count || 0;
    const reachScore = followers > 0 ? Math.min(100, (Math.log10(followers) / Math.log10(10_000_000)) * 100) : 0;
    const activityScore = 50;
    const composite =
      engagementScore * 0.30 +
      authenticityScore * 0.25 +
      brandSafetyScore * 0.20 +
      reachScore * 0.15 +
      activityScore * 0.10;

    return {
      id: inf.id,
      composite_score: Math.round(composite * 100) / 100,
      rank_position: 0,
      engagement_score: Math.round(engagementScore),
      authenticity_score: Math.round(authenticityScore),
      reach_score: Math.round(reachScore),
    };
  });

  scored.sort((a, b) => b.composite_score - a.composite_score);
  scored.forEach((s, i) => { s.rank_position = i + 1; });
  return scored;
}

async function generateOpportunities(apiKey: string, influencers: any[], scores: ScoredInfluencer[], companyProfile: any) {
  const companyCtx = companyProfile
    ? `Empresa: ${companyProfile.company_name || "N/A"}
Segmento: ${companyProfile.segment || "N/A"}
Público-alvo: ${companyProfile.target_audience || "N/A"}
Valores: ${companyProfile.brand_values || "N/A"}
Produtos: ${companyProfile.products_services || "N/A"}
Tom: ${companyProfile.brand_tone || "N/A"}
Objetivos: ${companyProfile.campaign_goals || "N/A"}`
    : "Perfil da empresa não configurado.";

  const infData = influencers.map(inf => {
    const sc = scores.find(s => s.id === inf.id);
    return {
      username: inf.username,
      platform: inf.platform,
      followers: inf.followers_count,
      engagement: inf.engagement_rate,
      fraud_score: inf.fraud_score,
      composite_score: sc?.composite_score || 0,
      rank: sc?.rank_position || 0,
    };
  });

  const systemPrompt = `Você é um consultor estratégico de marketing de influência. Analise os influenciadores monitorados e o perfil da empresa para gerar oportunidades.

Retorne APENAS um JSON com esta estrutura:
{
  "top_opportunities": [{"username": "string", "platform": "string", "score": number, "reason": "string"}],
  "alerts": [{"username": "string", "type": "crisis|engagement_drop|fraud", "message": "string"}],
  "trends": ["string"],
  "suggested_actions": ["string"],
  "generated_at": "ISO string"
}

Máximo 5 oportunidades, 3 alertas, 3 tendências, 5 ações.`;

  const userPrompt = `${companyCtx}

Influenciadores (${infData.length}):
${JSON.stringify(infData, null, 2)}`;

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
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI error:", response.status, errText);
    throw new Error(`AI error: ${response.status}`);
  }

  const aiData = await response.json();
  const content = aiData.choices?.[0]?.message?.content || "{}";

  try {
    const cleaned = content.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    parsed.generated_at = new Date().toISOString();
    return parsed;
  } catch {
    console.error("Failed to parse AI response:", content);
    return {
      top_opportunities: [],
      alerts: [],
      trends: [],
      suggested_actions: [],
      generated_at: new Date().toISOString(),
    };
  }
}
