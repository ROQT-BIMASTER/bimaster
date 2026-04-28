// Apify Influencer Search — busca dados reais de perfis Instagram/TikTok
// via Apify Actors (instagram-scraper, instagram-profile-scraper, tiktok-scraper).
//
// Endpoints internos (action no body):
//   - "search_hashtag"    → roda apify/instagram-hashtag-scraper
//   - "search_profile"    → roda apify/instagram-profile-scraper para 1+ usernames
//   - "search_tiktok"     → roda clockworks/tiktok-scraper por hashtag/perfil
//
// Usa run-sync-get-dataset-items (síncrono) com timeout para retorno imediato.

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface NormalizedInfluencer {
  username: string;
  display_name: string;
  platform: "instagram" | "tiktok" | "youtube";
  profile_url: string;
  avatar_url: string | null;
  followers_count: number;
  engagement_rate: number;
  avg_likes: number;
  avg_comments: number;
  niche: string | null;
  reason: string;
  source: string;
  bio?: string | null;
  is_verified?: boolean;
}

const APIFY_BASE = "https://api.apify.com/v2";

async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>,
  token: string,
  timeoutSecs = 60,
): Promise<any[]> {
  // Sync run with dataset items — Apify aguarda até o timeout e devolve resultados.
  const url = `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSecs}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`apify ${actorId} ${res.status}: ${txt.slice(0, 400)}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function normalizeIgProfile(item: any): NormalizedInfluencer | null {
  const username = item.username || item.ownerUsername || item.handle;
  if (!username) return null;
  const followers = Number(item.followersCount ?? item.followers ?? 0) || 0;
  const avgLikes = Number(item.avgLikes ?? item.averageLikes ?? 0) || 0;
  const avgComments = Number(item.avgComments ?? item.averageComments ?? 0) || 0;
  const er = followers > 0 ? ((avgLikes + avgComments) / followers) * 100 : 0;
  return {
    username: String(username).replace(/^@/, ""),
    display_name: item.fullName || item.displayName || username,
    platform: "instagram",
    profile_url: `https://instagram.com/${username}`,
    avatar_url: item.profilePicUrl || item.profilePicUrlHD || null,
    followers_count: followers,
    engagement_rate: Number(er.toFixed(2)),
    avg_likes: avgLikes,
    avg_comments: avgComments,
    niche: item.businessCategoryName || item.category || null,
    reason: item.biography ? `Perfil real Instagram. Bio: ${String(item.biography).slice(0, 120)}` : "Perfil real Instagram (Apify)",
    source: "apify_instagram",
    bio: item.biography || null,
    is_verified: Boolean(item.verified),
  };
}

function normalizeIgHashtagOwner(item: any): NormalizedInfluencer | null {
  const username = item.ownerUsername || item.username;
  if (!username) return null;
  return {
    username: String(username).replace(/^@/, ""),
    display_name: item.ownerFullName || username,
    platform: "instagram",
    profile_url: `https://instagram.com/${username}`,
    avatar_url: null,
    followers_count: 0, // hashtag posts não retornam followers, será enriquecido depois
    engagement_rate: 0,
    avg_likes: Number(item.likesCount || 0),
    avg_comments: Number(item.commentsCount || 0),
    niche: null,
    reason: `Encontrado via post com a hashtag (${item.likesCount || 0} curtidas)`,
    source: "apify_hashtag",
  };
}

function normalizeTiktokProfile(item: any): NormalizedInfluencer | null {
  const author = item.authorMeta || item;
  const username = author.name || author.uniqueId || author.username;
  if (!username) return null;
  const followers = Number(author.fans ?? author.followerCount ?? 0) || 0;
  return {
    username: String(username),
    display_name: author.nickName || author.nickname || username,
    platform: "tiktok",
    profile_url: `https://tiktok.com/@${username}`,
    avatar_url: author.avatar || author.avatarLarger || null,
    followers_count: followers,
    engagement_rate: 0,
    avg_likes: Number(author.heart ?? author.heartCount ?? 0) || 0,
    avg_comments: 0,
    niche: author.signature ? String(author.signature).slice(0, 80) : null,
    reason: "Perfil real TikTok (Apify)",
    source: "apify_tiktok",
    bio: author.signature || null,
    is_verified: Boolean(author.verified),
  };
}

function dedupe(list: NormalizedInfluencer[]): NormalizedInfluencer[] {
  const seen = new Set<string>();
  const out: NormalizedInfluencer[] = [];
  for (const i of list) {
    const key = `${i.platform}:${i.username.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(i);
  }
  return out;
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

    const APIFY_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!APIFY_TOKEN) {
      return new Response(JSON.stringify({
        error: "apify_not_configured",
        message: "APIFY_API_TOKEN não configurado.",
      }), { status: 503, headers: jsonHeaders });
    }

    const body = await req.json();
    const { query, platform = "instagram", limit = 10 } = body;

    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "Campo 'query' é obrigatório" }), { status: 400, headers: jsonHeaders });
    }

    const trimmed = query.trim();
    const isHashtag = trimmed.startsWith("#");
    const isUsername = trimmed.startsWith("@");
    const term = trimmed.replace(/^[#@]/, "");
    const limitNum = Math.min(Math.max(Number(limit) || 10, 1), 30);

    let results: NormalizedInfluencer[] = [];
    const errors: string[] = [];

    // === Instagram ===
    if (platform === "instagram" || platform === "all") {
      try {
        if (isUsername) {
          // Busca direta de perfil
          const items = await runApifyActor("apify/instagram-profile-scraper", {
            usernames: [term],
          }, APIFY_TOKEN, 60);
          for (const it of items) {
            const norm = normalizeIgProfile(it);
            if (norm) results.push(norm);
          }
        } else if (isHashtag) {
          // Busca posts da hashtag → extrai owners únicos → enriquece os top com profile-scraper
          const posts = await runApifyActor("apify/instagram-hashtag-scraper", {
            hashtags: [term],
            resultsLimit: limitNum * 3,
          }, APIFY_TOKEN, 90);
          const owners = new Map<string, any>();
          for (const p of posts) {
            const owner = p.ownerUsername;
            if (!owner) continue;
            const existing = owners.get(owner);
            if (!existing || (p.likesCount || 0) > (existing.likesCount || 0)) {
              owners.set(owner, p);
            }
          }
          // Pega top N owners por engajamento e busca perfis reais
          const topOwners = [...owners.values()]
            .sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))
            .slice(0, limitNum)
            .map((p) => p.ownerUsername);

          if (topOwners.length > 0) {
            try {
              const profiles = await runApifyActor("apify/instagram-profile-scraper", {
                usernames: topOwners,
              }, APIFY_TOKEN, 90);
              for (const pr of profiles) {
                const norm = normalizeIgProfile(pr);
                if (norm) {
                  norm.reason = `Criador ativo na hashtag #${term}`;
                  results.push(norm);
                }
              }
            } catch (e) {
              // Se enrich falhar, usa dados do hashtag scraper como fallback
              for (const p of [...owners.values()].slice(0, limitNum)) {
                const norm = normalizeIgHashtagOwner(p);
                if (norm) results.push(norm);
              }
              errors.push(`profile_enrich: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        } else {
          // Termo livre → busca por hashtag equivalente e por search direto
          const posts = await runApifyActor("apify/instagram-hashtag-scraper", {
            hashtags: [term.replace(/\s+/g, "")],
            resultsLimit: limitNum * 2,
          }, APIFY_TOKEN, 60);
          const owners = new Map<string, any>();
          for (const p of posts) {
            const o = p.ownerUsername;
            if (!o) continue;
            if (!owners.has(o)) owners.set(o, p);
          }
          const topOwners = [...owners.keys()].slice(0, limitNum);
          if (topOwners.length > 0) {
            const profiles = await runApifyActor("apify/instagram-profile-scraper", {
              usernames: topOwners,
            }, APIFY_TOKEN, 90);
            for (const pr of profiles) {
              const norm = normalizeIgProfile(pr);
              if (norm) results.push(norm);
            }
          }
        }
      } catch (e) {
        errors.push(`instagram: ${e instanceof Error ? e.message : String(e)}`);
        console.error("[apify-influencer-search] instagram error:", e);
      }
    }

    // === TikTok ===
    if (platform === "tiktok" || platform === "all") {
      try {
        const tiktokInput: any = isUsername
          ? { profiles: [term], resultsPerPage: 1 }
          : { hashtags: [term], resultsPerPage: limitNum };
        const items = await runApifyActor("clockworks/tiktok-scraper", tiktokInput, APIFY_TOKEN, 90);
        const seenAuthors = new Set<string>();
        for (const it of items) {
          const norm = normalizeTiktokProfile(it);
          if (norm && !seenAuthors.has(norm.username)) {
            seenAuthors.add(norm.username);
            results.push(norm);
          }
        }
      } catch (e) {
        errors.push(`tiktok: ${e instanceof Error ? e.message : String(e)}`);
        console.error("[apify-influencer-search] tiktok error:", e);
      }
    }

    results = dedupe(results)
      .filter((r) => r.username)
      .sort((a, b) => b.followers_count - a.followers_count)
      .slice(0, limitNum);

    return new Response(JSON.stringify({
      data: results,
      meta: {
        source: "apify",
        count: results.length,
        errors: errors.length > 0 ? errors : undefined,
        query: trimmed,
      },
    }), { status: 200, headers: jsonHeaders });

  } catch (error) {
    console.error("apify-influencer-search error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: "internal_error", message }), {
      status: 500, headers: jsonHeaders,
    });
  }
});
