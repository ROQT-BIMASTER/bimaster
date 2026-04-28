// Apify Influencer Search & Enrich
// =================================
// Actions (no body):
//   { query, platform, limit }                   → busca (compat. legado)
//   { action: "enrich", username, platform }     → perfil completo + 12 posts recentes
//
// Retorna sempre dados normalizados, com posts e metadados ricos quando disponíveis.

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface NormalizedPost {
  platform_post_id: string | null;
  post_url: string | null;
  post_type: string;
  caption: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
  likes: number;
  comments_count: number;
  shares: number;
  posted_at: string | null;
}

interface NormalizedInfluencer {
  username: string;
  display_name: string;
  platform: "instagram" | "tiktok" | "youtube";
  profile_url: string;
  avatar_url: string | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
  engagement_rate: number;
  avg_likes: number;
  avg_comments: number;
  niche: string | null;
  reason: string;
  source: string;
  bio: string | null;
  is_verified: boolean;
  is_private: boolean;
  business_category: string | null;
  external_url: string | null;
  latest_posts: NormalizedPost[];
}

const APIFY_BASE = "https://api.apify.com/v2";

async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>,
  token: string,
  timeoutSecs = 120,
): Promise<any[]> {
  const url = `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSecs}&memory=2048`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), (timeoutSecs + 10) * 1000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`apify ${actorId} ${res.status}: ${txt.slice(0, 400)}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } finally {
    clearTimeout(t);
  }
}

function normalizeIgPost(p: any): NormalizedPost | null {
  const id = p.id || p.shortCode || p.shortcode || null;
  if (!id) return null;
  const type = p.type === "Video" || p.videoUrl ? "video" : (p.type === "Sidecar" ? "carousel" : "image");
  return {
    platform_post_id: String(id),
    post_url: p.url || (p.shortCode ? `https://www.instagram.com/p/${p.shortCode}/` : null),
    post_type: type,
    caption: p.caption || null,
    thumbnail_url: p.displayUrl || p.thumbnailUrl || null,
    media_url: p.videoUrl || p.displayUrl || null,
    likes: Number(p.likesCount || 0),
    comments_count: Number(p.commentsCount || 0),
    shares: 0,
    posted_at: p.timestamp || p.taken_at_timestamp || null,
  };
}

function normalizeIgProfile(item: any): NormalizedInfluencer | null {
  const username = item.username || item.ownerUsername || item.handle;
  if (!username) return null;
  const followers = Number(item.followersCount ?? item.followers ?? 0) || 0;
  const following = Number(item.followsCount ?? item.followingCount ?? 0) || 0;
  const postsCount = Number(item.postsCount ?? item.mediaCount ?? 0) || 0;

  const latest = Array.isArray(item.latestPosts) ? item.latestPosts.slice(0, 12) : [];
  const posts: NormalizedPost[] = latest
    .map(normalizeIgPost)
    .filter((p: NormalizedPost | null): p is NormalizedPost => p !== null);

  // Médias reais vindas dos últimos posts (fallback para campos diretos do scraper)
  const sumLikes = posts.reduce((s, p) => s + p.likes, 0);
  const sumComments = posts.reduce((s, p) => s + p.comments_count, 0);
  const avgLikes = posts.length > 0 ? Math.round(sumLikes / posts.length) : Number(item.avgLikes ?? 0) || 0;
  const avgComments = posts.length > 0 ? Math.round(sumComments / posts.length) : Number(item.avgComments ?? 0) || 0;
  const er = followers > 0 ? ((avgLikes + avgComments) / followers) * 100 : 0;

  return {
    username: String(username).replace(/^@/, ""),
    display_name: item.fullName || item.displayName || username,
    platform: "instagram",
    profile_url: `https://instagram.com/${username}`,
    avatar_url: item.profilePicUrlHD || item.profilePicUrl || null,
    followers_count: followers,
    following_count: following,
    posts_count: postsCount,
    engagement_rate: Number(er.toFixed(2)),
    avg_likes: avgLikes,
    avg_comments: avgComments,
    niche: item.businessCategoryName || item.category || null,
    reason: item.biography ? `Bio: ${String(item.biography).slice(0, 120)}` : "Perfil real Instagram (Apify)",
    source: "apify_instagram",
    bio: item.biography || null,
    is_verified: Boolean(item.verified),
    is_private: Boolean(item.private),
    business_category: item.businessCategoryName || item.categoryName || null,
    external_url: item.externalUrl || item.externalUrlShimmed || null,
    latest_posts: posts,
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
    followers_count: 0,
    following_count: 0,
    posts_count: 0,
    engagement_rate: 0,
    avg_likes: Number(item.likesCount || 0),
    avg_comments: Number(item.commentsCount || 0),
    niche: null,
    reason: `Encontrado via post com a hashtag (${item.likesCount || 0} curtidas)`,
    source: "apify_hashtag",
    bio: null,
    is_verified: false,
    is_private: false,
    business_category: null,
    external_url: null,
    latest_posts: [],
  };
}

function normalizeTiktokVideo(v: any): NormalizedPost | null {
  const id = v.id || v.videoUrl;
  if (!id) return null;
  return {
    platform_post_id: String(v.id || ""),
    post_url: v.webVideoUrl || null,
    post_type: "video",
    caption: v.text || null,
    thumbnail_url: v.videoMeta?.coverUrl || v.covers?.[0] || null,
    media_url: v.videoUrl || null,
    likes: Number(v.diggCount || 0),
    comments_count: Number(v.commentCount || 0),
    shares: Number(v.shareCount || 0),
    posted_at: v.createTimeISO || (v.createTime ? new Date(v.createTime * 1000).toISOString() : null),
  };
}

function normalizeTiktokProfile(item: any): NormalizedInfluencer | null {
  const author = item.authorMeta || item;
  const username = author.name || author.uniqueId || author.username;
  if (!username) return null;
  const followers = Number(author.fans ?? author.followerCount ?? 0) || 0;
  const following = Number(author.following ?? author.followingCount ?? 0) || 0;
  const videoCount = Number(author.video ?? author.videoCount ?? 0) || 0;

  return {
    username: String(username),
    display_name: author.nickName || author.nickname || username,
    platform: "tiktok",
    profile_url: `https://tiktok.com/@${username}`,
    avatar_url: author.avatar || author.avatarLarger || null,
    followers_count: followers,
    following_count: following,
    posts_count: videoCount,
    engagement_rate: 0,
    avg_likes: Number(author.heart ?? author.heartCount ?? 0) || 0,
    avg_comments: 0,
    niche: author.signature ? String(author.signature).slice(0, 80) : null,
    reason: "Perfil real TikTok (Apify)",
    source: "apify_tiktok",
    bio: author.signature || null,
    is_verified: Boolean(author.verified),
    is_private: Boolean(author.privateAccount),
    business_category: null,
    external_url: author.bioLink?.link || null,
    latest_posts: [],
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

// === ENRICH MODE: 1 perfil completo + 12 posts recentes ===
async function enrichSingle(
  username: string,
  platform: string,
  apifyToken: string,
): Promise<NormalizedInfluencer | null> {
  const term = username.replace(/^@/, "");
  if (platform === "tiktok") {
    const items = await runApifyActor("clockworks/tiktok-scraper", {
      profiles: [term],
      resultsPerPage: 12,
      shouldDownloadVideos: false,
    }, apifyToken, 90);
    if (items.length === 0) return null;
    const norm = normalizeTiktokProfile(items[0]);
    if (norm) {
      // Extrai vídeos como posts (TikTok scraper devolve um item por vídeo + meta do autor em cada)
      const videos = items
        .map(normalizeTiktokVideo)
        .filter((v: NormalizedPost | null): v is NormalizedPost => v !== null)
        .slice(0, 12);
      norm.latest_posts = videos;
      const totalLikes = videos.reduce((s, v) => s + v.likes, 0);
      const totalComments = videos.reduce((s, v) => s + v.comments_count, 0);
      if (videos.length > 0) {
        norm.avg_likes = Math.round(totalLikes / videos.length);
        norm.avg_comments = Math.round(totalComments / videos.length);
        norm.engagement_rate = norm.followers_count > 0
          ? Number((((norm.avg_likes + norm.avg_comments) / norm.followers_count) * 100).toFixed(2))
          : 0;
      }
    }
    return norm;
  }
  // Instagram (default)
  const items = await runApifyActor("apify/instagram-profile-scraper", {
    usernames: [term],
    resultsLimit: 12,
  }, apifyToken, 90);
  if (items.length === 0) return null;
  return normalizeIgProfile(items[0]);
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

    // ================================================================
    // ACTION: enrich → perfil completo (usado por sync e por addDialog)
    // ================================================================
    if (body.action === "enrich") {
      const { username, platform = "instagram" } = body;
      if (!username || typeof username !== "string") {
        return new Response(JSON.stringify({ error: "username obrigatório" }), { status: 400, headers: jsonHeaders });
      }
      try {
        const norm = await enrichSingle(username, platform, APIFY_TOKEN);
        if (!norm) {
          return new Response(JSON.stringify({ data: null, message: "Perfil não encontrado" }), {
            status: 200, headers: jsonHeaders,
          });
        }
        return new Response(JSON.stringify({ data: norm }), { status: 200, headers: jsonHeaders });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return new Response(JSON.stringify({ error: "enrich_failed", message: msg }), {
          status: 502, headers: jsonHeaders,
        });
      }
    }

    // ================================================================
    // SEARCH MODE (legado, mantido)
    // ================================================================
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
          const items = await runApifyActor("apify/instagram-profile-scraper", {
            usernames: [term],
            resultsLimit: 12,
          }, APIFY_TOKEN, 90);
          for (const it of items) {
            const norm = normalizeIgProfile(it);
            if (norm) results.push(norm);
          }
        } else if (isHashtag || true) {
          // Hashtag ou termo livre — usa hashtag-scraper (mais leve) e enriquece top 5 em paralelo
          const cleanTerm = term.replace(/\s+/g, "").toLowerCase();
          let posts: any[] = [];
          try {
            posts = await runApifyActor("apify/instagram-hashtag-scraper", {
              hashtags: [cleanTerm],
              resultsLimit: limitNum * 2,
            }, APIFY_TOKEN, 90);
          } catch (_e) {
            // Fallback: instagram-scraper via directUrls
            posts = await runApifyActor("apify/instagram-scraper", {
              directUrls: [`https://www.instagram.com/explore/tags/${cleanTerm}/`],
              resultsType: "posts",
              resultsLimit: limitNum * 2,
              searchType: "hashtag",
              searchLimit: 1,
            }, APIFY_TOKEN, 90);
          }

          const owners = new Map<string, any>();
          for (const p of posts) {
            const owner = p.ownerUsername;
            if (!owner) continue;
            const existing = owners.get(owner);
            if (!existing || (p.likesCount || 0) > (existing.likesCount || 0)) {
              owners.set(owner, p);
            }
          }
          const topOwners = [...owners.values()]
            .sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))
            .slice(0, Math.min(5, limitNum))
            .map((p) => p.ownerUsername);

          if (topOwners.length > 0) {
            // Enriquecimento em paralelo (cada perfil em chamada separada para timeout individual)
            const enriched = await Promise.allSettled(
              topOwners.map((u: string) =>
                runApifyActor("apify/instagram-profile-scraper", {
                  usernames: [u],
                  resultsLimit: 12,
                }, APIFY_TOKEN, 60)
              )
            );
            for (const r of enriched) {
              if (r.status === "fulfilled") {
                for (const it of r.value) {
                  const norm = normalizeIgProfile(it);
                  if (norm) {
                    norm.reason = `Criador ativo na hashtag #${cleanTerm}`;
                    results.push(norm);
                  }
                }
              }
            }
          }

          // Tenta também perfil direto com mesmo nome (#luluca → @luluca)
          if (isHashtag) {
            try {
              const direct = await runApifyActor("apify/instagram-profile-scraper", {
                usernames: [cleanTerm],
                resultsLimit: 12,
              }, APIFY_TOKEN, 60);
              for (const pr of direct) {
                const norm = normalizeIgProfile(pr);
                if (norm) {
                  norm.reason = `Perfil oficial @${norm.username} (mesmo nome da hashtag)`;
                  results.unshift(norm);
                }
              }
            } catch (_e) { /* silencioso */ }
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
          ? { profiles: [term], resultsPerPage: 5 }
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
