import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface DiscoveredInfluencer {
  username: string;
  display_name: string;
  platform: string;
  profile_url: string | null;
  avatar_url: string | null;
  followers_count: number;
  engagement_rate: number;
  avg_likes: number;
  avg_comments: number;
  niche: string | null;
  reason: string;
  source?: string;
}

const SYSTEM_PROMPT = `Você é um especialista sênior em marketing de influenciadores no Brasil com acesso à BUSCA WEB EM TEMPO REAL via Google Search.

OBJETIVO: encontrar influenciadores REAIS e VERIFICÁVEIS que correspondam à busca do usuário.

REGRAS OBRIGATÓRIAS:
1. SEMPRE use a ferramenta de busca web (google_search) ANTES de responder. Nunca confie apenas em conhecimento prévio.
2. Quando a busca começar com "#" (hashtag), procure por:
   - "site:instagram.com/explore/tags/<hashtag>"
   - "<hashtag> tiktok influenciador brasil"
   - "<hashtag> creator instagram"
   - O perfil principal/criador associado àquela hashtag
3. Quando começar com "@", procure exatamente esse perfil em todas as plataformas.
4. Quando for um tema (ex: "tech reviewers", "skincare brasil"), busque rankings, listas e perfis ativos brasileiros.
5. Para CADA influenciador retornado, faça uma busca específica para obter:
   - Username exato (sem @)
   - Contagem ATUAL de seguidores (do perfil oficial ou de tracker como Social Blade)
   - URL real do perfil
   - Nicho principal
6. NUNCA invente perfis. Se não encontrar resultado real, retorne array vazio.
7. Priorize criadores brasileiros quando a busca tiver contexto BR (português, hashtag em pt, marca brasileira).
8. Retorne até 12 influenciadores ordenados por relevância para a query.

FORMATO DE SAÍDA: APENAS um JSON array válido (sem markdown, sem texto extra), onde cada item tem:
{
  "username": "string sem @",
  "display_name": "string",
  "platform": "instagram" | "tiktok" | "youtube" | "twitter",
  "profile_url": "URL real e funcional",
  "avatar_url": null,
  "followers_count": number,
  "engagement_rate": number,
  "avg_likes": number,
  "avg_comments": number,
  "niche": "string",
  "reason": "por que esse perfil é relevante para a busca"
}`;

function buildUserPrompt(query: string, platform?: string, min?: number, max?: number) {
  const platformFilter = platform && platform !== "all" ? ` na plataforma ${platform}` : "";
  const fRange = (min || max)
    ? ` com ${min ? `mínimo de ${min}` : ""}${min && max ? " e " : ""}${max ? `máximo de ${max}` : ""} seguidores`
    : "";

  let hint = "";
  const trimmed = query.trim();
  if (trimmed.startsWith("#")) {
    const tag = trimmed.slice(1);
    hint = `\n\nA busca é uma HASHTAG: "#${tag}". Faça buscas como:\n- "${tag}" instagram criadora\n- "${tag}" tiktok influenciador\n- "site:instagram.com ${tag}"\n- "perfil ${tag} brasil"\nIdentifique a(s) pessoa(s)/criador(es) por trás dessa hashtag e perfis ativos que a usam.`;
  } else if (trimmed.startsWith("@")) {
    const handle = trimmed.slice(1);
    hint = `\n\nA busca é um USERNAME: "@${handle}". Localize esse perfil específico no Instagram, TikTok, YouTube e Twitter/X. Confirme dados oficiais.`;
  }

  return `Buscar influenciadores: "${trimmed}"${platformFilter}${fRange}.${hint}\n\nUse a busca web AGORA. Retorne SOMENTE o JSON array.`;
}

async function callGeminiGrounded(query: string, platform: string | undefined, min: number | undefined, max: number | undefined, apiKey: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(query, platform, min, max) },
      ],
      tools: [{ type: "google_search" }],
      temperature: 0.2,
    }),
  });
  return res;
}

async function callGptFallback(query: string, platform: string | undefined, min: number | undefined, max: number | undefined, apiKey: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.2",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(query, platform, min, max) },
      ],
      temperature: 0.3,
    }),
  });
  return res;
}

function parseAIResults(content: string): DiscoveredInfluencer[] {
  if (!content) return [];
  try {
    // Remove fences and isolate JSON array
    let cleaned = content.replace(/```json?/gi, "").replace(/```/g, "").trim();
    const firstBracket = cleaned.indexOf("[");
    const lastBracket = cleaned.lastIndexOf("]");
    if (firstBracket >= 0 && lastBracket > firstBracket) {
      cleaned = cleaned.slice(firstBracket, lastBracket + 1);
    }
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("parseAIResults failed:", e, "content:", content.slice(0, 500));
    return [];
  }
}

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
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: jsonHeaders });
    }

    const body = await req.json();
    const { query, platform, min_followers, max_followers, force } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Campo 'query' é obrigatório" }), { status: 400, headers: jsonHeaders });
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify({
        error: "ai_not_configured",
        message: "Chave da API de IA não configurada.",
      }), { status: 503, headers: jsonHeaders });
    }

    const minN = min_followers ? Number(min_followers) : undefined;
    const maxN = max_followers ? Number(max_followers) : undefined;

    let results: DiscoveredInfluencer[] = [];
    let usedSource = "apify";
    let primaryError: string | null = null;

    // ---- Layer 0: Apify (dados reais Instagram/TikTok) ----
    const apifyToken = Deno.env.get("APIFY_API_TOKEN");
    if (apifyToken) {
      try {
        const apifyRes = await fetch(`${supabaseUrl}/functions/v1/apify-influencer-search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify({
            query,
            platform: platform || "instagram",
            limit: 12,
          }),
        });
        if (apifyRes.ok) {
          const apifyData = await apifyRes.json();
          if (Array.isArray(apifyData?.data) && apifyData.data.length > 0) {
            results = apifyData.data as DiscoveredInfluencer[];
            console.log(`[discover-influencers] apify returned ${results.length} real profiles for "${query}"`);
          } else {
            console.log(`[discover-influencers] apify returned 0 results, falling back to AI`);
          }
        } else {
          const t = await apifyRes.text();
          console.error(`[discover-influencers] apify failed ${apifyRes.status}: ${t.slice(0, 200)}`);
        }
      } catch (e) {
        console.error("[discover-influencers] apify exception:", e);
      }
    }

    // ---- Layer 1: Gemini 2.5 Pro with REAL Google Search grounding (fallback) ----
    if (results.length === 0) {
      usedSource = "gemini_grounded";

    try {
      const geminiRes = await callGeminiGrounded(query, platform, minN, maxN, lovableApiKey);
      if (geminiRes.status === 429) {
        return new Response(JSON.stringify({
          error: "rate_limit",
          message: "Limite de requisições atingido. Aguarde alguns segundos e tente novamente.",
        }), { status: 429, headers: jsonHeaders });
      }
      if (geminiRes.status === 402) {
        return new Response(JSON.stringify({
          error: "credits_exhausted",
          message: "Créditos de IA esgotados. Adicione créditos em Configurações > Workspace > Uso.",
        }), { status: 402, headers: jsonHeaders });
      }
      if (geminiRes.ok) {
        const data = await geminiRes.json();
        const content = data.choices?.[0]?.message?.content || "";
        results = parseAIResults(content);
        console.log(`[discover-influencers] gemini_grounded returned ${results.length} results for query="${query}"`);
      } else {
        const errText = await geminiRes.text();
        primaryError = `gemini ${geminiRes.status}: ${errText.slice(0, 300)}`;
        console.error("[discover-influencers] gemini failed:", primaryError);
      }
    } catch (e) {
      primaryError = `gemini exception: ${e instanceof Error ? e.message : String(e)}`;
      console.error("[discover-influencers] gemini exception:", e);
    }

    // ---- Layer 2: GPT-5.2 fallback (no grounding but better reasoning) ----
    if (results.length === 0) {
      console.log("[discover-influencers] falling back to gpt-5.2");
      try {
        const gptRes = await callGptFallback(query, platform, minN, maxN, lovableApiKey);
        if (gptRes.ok) {
          const data = await gptRes.json();
          const content = data.choices?.[0]?.message?.content || "";
          results = parseAIResults(content);
          if (results.length > 0) usedSource = "gpt5_fallback";
          console.log(`[discover-influencers] gpt fallback returned ${results.length} results`);
        } else {
          const errText = await gptRes.text();
          console.error("[discover-influencers] gpt fallback failed:", gptRes.status, errText.slice(0, 300));
        }
      } catch (e) {
        console.error("[discover-influencers] gpt fallback exception:", e);
      }
      }
    } // end if (results.length === 0) — fallback Gemini/GPT block

    // ---- Apply followers filter and tag source ----
    if (minN || maxN) {
      results = results.filter((r) => {
        if (minN && Number(r.followers_count) < minN) return false;
        if (maxN && Number(r.followers_count) > maxN) return false;
        return true;
      });
    }
    results = results.map((r) => ({ ...r, source: r.source || usedSource }));

    return new Response(JSON.stringify({
      data: results,
      meta: {
        source: usedSource,
        primary_error: primaryError,
        count: results.length,
      },
    }), { status: 200, headers: jsonHeaders });

  } catch (error) {
    console.error("discover-influencers error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: "internal_error", message }), {
      status: 500, headers: jsonHeaders,
    });
  }
});
