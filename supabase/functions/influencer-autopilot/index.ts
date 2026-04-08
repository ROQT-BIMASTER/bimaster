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

    if (action === "discover_new") {
      // Discover new influencers based on company profile
      const companyCtx = companyProfile
        ? `Empresa: ${companyProfile.company_name || "N/A"}
Segmento: ${companyProfile.segment || "N/A"}
Público-alvo: ${companyProfile.target_audience || "N/A"}
Valores: ${companyProfile.brand_values || "N/A"}
Produtos: ${companyProfile.products_services || "N/A"}
Tom: ${companyProfile.brand_tone || "N/A"}
Plataformas preferidas: ${companyProfile.preferred_platforms?.join(", ") || "instagram, tiktok, youtube"}`
        : "Perfil da empresa não configurado. Sugerir influenciadores populares variados.";

      // Get existing usernames to avoid duplicates
      const existingUsernames = infList.map(i => i.username.toLowerCase());
      
      // Also check existing pending suggestions
      const { data: existingSuggestions } = await supabase
        .from("influencer_suggestions")
        .select("username")
        .eq("user_id", user.id)
        .in("status", ["pending", "approved"]);
      const suggestedUsernames = (existingSuggestions || []).map((s: any) => s.username.toLowerCase());
      const allExisting = [...existingUsernames, ...suggestedUsernames];

      const discoverPrompt = `Você é um especialista em marketing de influenciadores. Descubra 10-15 influenciadores REAIS que seriam ideais para esta empresa.

${companyCtx}

Influenciadores JÁ CADASTRADOS (NÃO sugerir estes): ${allExisting.join(", ") || "nenhum"}

Retorne APENAS um JSON array. Cada item:
- "username": string (sem @, perfil real verificável)
- "display_name": string
- "platform": "instagram" | "tiktok" | "youtube" | "twitter"
- "profile_url": string (URL real)
- "followers_count": number (estimativa)
- "engagement_rate": number (% estimada)
- "niche": string (nicho principal)
- "reason": string (por que é relevante para esta empresa)
- "score": number (0-100, relevância para o perfil da empresa)

IMPORTANTE:
- Apenas influenciadores REAIS com perfis verificáveis
- NÃO incluir nenhum username da lista de já cadastrados
- Priorizar influenciadores que se alinham ao segmento e público da empresa
- Diversificar plataformas conforme preferências
- Score deve refletir o fit com o perfil da empresa`;

      const aiResp = await fetch(AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: "Retorne APENAS JSON array, sem texto adicional." },
            { role: "user", content: discoverPrompt },
          ],
          temperature: 0.4,
        }),
      });

      if (!aiResp.ok) {
        const errText = await aiResp.text();
        console.error("AI discover error:", aiResp.status, errText);
        return new Response(JSON.stringify({ error: "Erro na IA ao descobrir influenciadores" }), { status: 502, headers: jsonHeaders });
      }

      const aiData = await aiResp.json();
      const content = aiData.choices?.[0]?.message?.content || "[]";

      let results: any[];
      try {
        const cleaned = content.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
        results = JSON.parse(cleaned);
        if (!Array.isArray(results)) results = [];
      } catch {
        console.error("Failed to parse discover response:", content);
        results = [];
      }

      // Filter out duplicates
      results = results.filter((r: any) => !allExisting.includes((r.username || "").toLowerCase()));

      // Insert suggestions
      const records = results.map((r: any) => ({
        user_id: user.id,
        username: r.username || "unknown",
        display_name: r.display_name || null,
        platform: r.platform || "instagram",
        profile_url: r.profile_url || null,
        followers_count: r.followers_count || 0,
        engagement_rate: r.engagement_rate || 0,
        niche: r.niche || null,
        reason: r.reason || null,
        score: r.score || 50,
        status: "pending",
      }));

      if (records.length > 0) {
        await supabaseAdmin.from("influencer_suggestions").insert(records);
      }

      return new Response(JSON.stringify({ data: { suggestions_count: records.length } }), { status: 200, headers: jsonHeaders });
    }

    if (action === "analyze_audience") {
      const { influencer_id } = body;
      if (!influencer_id) {
        return new Response(JSON.stringify({ error: "influencer_id obrigatório" }), { status: 400, headers: jsonHeaders });
      }

      const { data: inf } = await supabase
        .from("influencers")
        .select("*")
        .eq("id", influencer_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!inf) {
        return new Response(JSON.stringify({ error: "Influenciador não encontrado" }), { status: 404, headers: jsonHeaders });
      }

      // Get recent posts for context
      const { data: recentPosts } = await supabase
        .from("influencer_posts")
        .select("caption, likes_count, comments_count, posted_at")
        .eq("influencer_id", influencer_id)
        .order("posted_at", { ascending: false })
        .limit(10);

      const postsContext = (recentPosts || []).map(p => `- "${(p.caption || "").slice(0, 100)}" (${p.likes_count} likes, ${p.comments_count} comments)`).join("\n");

      const audiencePrompt = `Você é um analista de marketing digital especializado em análise demográfica de audiências de influenciadores.

Analise este influenciador e estime o perfil demográfico da audiência:

Influenciador: @${inf.username}
Plataforma: ${inf.platform}
Seguidores: ${inf.followers_count}
Engajamento: ${inf.engagement_rate}%
Nicho/Notas: ${inf.notes || "N/A"}
${postsContext ? `\nPosts recentes:\n${postsContext}` : ""}
${companyProfile ? `\nEmpresa: ${companyProfile.company_name || "N/A"}, Segmento: ${companyProfile.segment || "N/A"}` : ""}

Retorne APENAS um JSON com esta estrutura exata:
{
  "gender_distribution": [
    {"label": "Feminino", "percentage": number},
    {"label": "Masculino", "percentage": number},
    {"label": "Outros", "percentage": number}
  ],
  "age_distribution": [
    {"range": "13-17", "percentage": number},
    {"range": "18-24", "percentage": number},
    {"range": "25-34", "percentage": number},
    {"range": "35-44", "percentage": number},
    {"range": "45-54", "percentage": number},
    {"range": "55+", "percentage": number}
  ],
  "consumer_profile": {
    "purchasing_power": "string (ex: Médio-Alto, Classe B/C)",
    "interests": ["string array com 4-6 interesses principais"],
    "buying_habits": "string descrevendo comportamento de compra"
  },
  "follower_persona": "string com 2-3 frases descrevendo a persona típica do seguidor",
  "estimated_region": {
    "regiao": "string (Norte|Nordeste|Centro-Oeste|Sudeste|Sul)",
    "uf": "string (sigla do estado, ex: SP, RJ, MG)"
  }
}

As percentagens devem somar 100% em cada distribuição. Base sua estimativa no nicho, plataforma, tipo de conteúdo e engajamento. Estime a região/estado com base no conteúdo, idioma, referências geográficas e público típico.`;

      const aiResp = await fetch(AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: "Retorne APENAS JSON válido, sem texto adicional." },
            { role: "user", content: audiencePrompt },
          ],
          temperature: 0.3,
        }),
      });

      if (!aiResp.ok) {
        const errText = await aiResp.text();
        console.error("AI audience error:", aiResp.status, errText);
        return new Response(JSON.stringify({ error: "Erro na IA ao analisar audiência" }), { status: 502, headers: jsonHeaders });
      }

      const aiData = await aiResp.json();
      const content = aiData.choices?.[0]?.message?.content || "{}";

      let result: any;
      try {
        const cleaned = content.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
        result = JSON.parse(cleaned);
      } catch {
        console.error("Failed to parse audience response:", content);
        return new Response(JSON.stringify({ error: "Falha ao interpretar resposta da IA" }), { status: 500, headers: jsonHeaders });
      }

      // Persist to influencer_analyses
      await supabaseAdmin.from("influencer_analyses").insert({
        influencer_id,
        user_id: user.id,
        analysis_type: "audience_profile",
        result,
      });

      // Update region/UF if empty and AI estimated
      if (result.estimated_region && (!inf.regiao || !inf.uf)) {
        const updateFields: any = {};
        if (!inf.regiao && result.estimated_region.regiao) updateFields.regiao = result.estimated_region.regiao;
        if (!inf.uf && result.estimated_region.uf) updateFields.uf = result.estimated_region.uf;
        if (Object.keys(updateFields).length > 0) {
          await supabase.from("influencers").update(updateFields).eq("id", influencer_id);
        }
      }

      return new Response(JSON.stringify({ data: result }), { status: 200, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ error: "action inválida. Use: calculate_scores, analyze_opportunities, auto_monitor, discover_new, analyze_audience" }), { status: 400, headers: jsonHeaders });

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
