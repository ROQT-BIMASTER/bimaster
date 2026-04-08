import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const headers = getCorsHeaders(req);
  const jsonHeaders = { ...headers, "Content-Type": "application/json" };

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: jsonHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: jsonHeaders,
      });
    }

    const body = await req.json();
    const { query, platform, min_followers, max_followers } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Campo 'query' é obrigatório" }), {
        status: 400, headers: jsonHeaders,
      });
    }

    // Build AI prompt for influencer discovery
    const platformFilter = platform && platform !== "all" ? ` na plataforma ${platform}` : "";
    const followersFilter = min_followers || max_followers
      ? ` com ${min_followers ? `mínimo de ${min_followers}` : ""}${min_followers && max_followers ? " e " : ""}${max_followers ? `máximo de ${max_followers}` : ""} seguidores`
      : "";

    const systemPrompt = `Você é um especialista em marketing de influenciadores. O usuário vai buscar influenciadores por perfil, hashtag, marca ou descrição.
Retorne APENAS um JSON array com até 12 influenciadores REAIS e verificáveis. Cada item deve ter:
- "username": string (sem @)
- "display_name": string
- "platform": "instagram" | "tiktok" | "youtube" | "twitter"
- "profile_url": string (URL real do perfil)
- "avatar_url": null
- "followers_count": number (contagem ATUAL verificada via pesquisa web)
- "engagement_rate": number (taxa percentual estimada)
- "avg_likes": number (estimativa)
- "avg_comments": number (estimativa)
- "niche": string (nicho principal)
- "reason": string (por que esse influenciador é relevante para a busca)

DADOS OBRIGATORIAMENTE ATUALIZADOS:
- Use pesquisa na web para obter a contagem ATUAL de seguidores de cada influenciador
- NÃO estime com base em conhecimento prévio — consulte fontes recentes e atualizadas
- Os números de seguidores devem refletir os dados mais recentes disponíveis na web
- Retorne SOMENTE influenciadores REAIS com perfis verificáveis
- Não invente perfis fictícios
- Responda APENAS com o JSON array, sem texto adicional`;

    const userPrompt = `Buscar influenciadores: "${query.trim()}"${platformFilter}${followersFilter}`;

    // Use Lovable AI Gateway with Pro model + Google Search grounding
    const aiGatewayUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(JSON.stringify({
        error: "ai_not_configured",
        message: "Chave da API Lovable não configurada.",
      }), { status: 503, headers: jsonHeaders });
    }

    const aiResponse = await fetch(aiGatewayUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.2",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", errText);
      return new Response(JSON.stringify({
        error: "ai_error",
        message: "Erro ao consultar IA para descoberta de influenciadores.",
      }), { status: 502, headers: jsonHeaders });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";

    // Parse JSON from AI response
    let results: unknown[];
    try {
      // Remove markdown code fences if present
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
      results = JSON.parse(cleaned);
      if (!Array.isArray(results)) results = [];
    } catch {
      console.error("Failed to parse AI response:", content);
      results = [];
    }

    // Filter by followers if specified
    if (min_followers || max_followers) {
      results = results.filter((r: any) => {
        if (min_followers && r.followers_count < Number(min_followers)) return false;
        if (max_followers && r.followers_count > Number(max_followers)) return false;
        return true;
      });
    }

    return new Response(JSON.stringify({ data: results }), {
      status: 200, headers: jsonHeaders,
    });

  } catch (error) {
    console.error("discover-influencers error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: jsonHeaders,
    });
  }
});
