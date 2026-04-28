// Apify Influencer Search & Enrich
// =================================
// Estratégia tolerante a falhas:
//   - Cada actor roda em paralelo, com timeout individual e budget global (~25s)
//   - Falhas/timeouts não derrubam outras estratégias (Promise.allSettled)
//   - Cache negativo (status='empty'|'timeout', TTL 2h) evita reconsumo de Apify
//   - Cache positivo (TTL 7 dias) cobre buscas e perfis individuais
//   - Toda execução Apify é registrada em apify_run_log para auditoria
//
// Actions:
//   { query, platform, limit }                   → busca
//   { action: "enrich", username, platform }     → perfil completo + posts recentes

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

// =============================================================
// Cache helpers (discovered_profiles + discovery_searches)
// =============================================================
function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/^[#@]/, "").replace(/\s+/g, " ");
}

async function readProfileCache(
  serviceClient: any,
  platform: string,
  username: string,
): Promise<any | null> {
  const { data } = await serviceClient
    .from("discovered_profiles")
    .select("*")
    .eq("platform", platform)
    .eq("username", username.toLowerCase())
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data || null;
}

function profileRowToNormalized(row: any): any {
  return {
    username: row.username,
    display_name: row.display_name || row.username,
    platform: row.platform,
    profile_url: row.profile_url,
    avatar_url: row.avatar_url,
    followers_count: row.followers_count || 0,
    following_count: row.following_count || 0,
    posts_count: row.posts_count || 0,
    engagement_rate: Number(row.engagement_rate || 0),
    avg_likes: row.avg_likes || 0,
    avg_comments: row.avg_comments || 0,
    niche: row.niche,
    reason: "Resultado em cache",
    source: row.data_source || "apify_cache",
    bio: row.bio,
    is_verified: !!row.is_verified,
    is_private: !!row.is_private,
    business_category: row.business_category,
    external_url: row.external_url,
    latest_posts: Array.isArray(row.latest_posts) ? row.latest_posts : [],
    avatar_storage_path: row.avatar_storage_path || null,
    cached: true,
    cached_at: row.last_apify_sync_at,
  };
}

async function upsertProfileCacheBatch(
  serviceClient: any,
  norms: any[],
  ttlDays = 7,
) {
  if (norms.length === 0) return;
  const expires = new Date(Date.now() + ttlDays * 86400 * 1000).toISOString();
  const rows = norms.map((norm) => ({
    platform: norm.platform,
    username: String(norm.username).toLowerCase(),
    display_name: norm.display_name,
    profile_url: norm.profile_url,
    avatar_url: norm.avatar_url,
    bio: norm.bio,
    is_verified: !!norm.is_verified,
    is_private: !!norm.is_private,
    business_category: norm.business_category,
    external_url: norm.external_url,
    niche: norm.niche,
    followers_count: norm.followers_count || 0,
    following_count: norm.following_count || 0,
    posts_count: norm.posts_count || 0,
    engagement_rate: norm.engagement_rate || 0,
    avg_likes: norm.avg_likes || 0,
    avg_comments: norm.avg_comments || 0,
    latest_posts: norm.latest_posts || [],
    raw_payload: null,
    data_source: "apify",
    last_apify_sync_at: new Date().toISOString(),
    expires_at: expires,
  }));
  await serviceClient.from("discovered_profiles").upsert(rows, {
    onConflict: "platform,username",
  });
}

async function readSearchCache(
  serviceClient: any,
  query: string,
  platform: string | null,
  minF: number | null,
  maxF: number | null,
): Promise<{ data: any[]; status: string } | null> {
  const { data } = await serviceClient
    .from("discovery_searches")
    .select("result_usernames, status, created_at")
    .eq("query_normalized", query)
    .eq("platform", platform || "all")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  // Cache negativo válido — evita reconsumo
  if (data.status === "empty" || data.status === "timeout") {
    return { data: [], status: data.status };
  }

  const list = Array.isArray(data.result_usernames) ? data.result_usernames : [];
  if (list.length === 0) return { data: [], status: "empty" };

  const { data: profiles } = await serviceClient
    .from("discovered_profiles")
    .select("*")
    .in("username", list.map((x: any) => String(x.username || x).toLowerCase()))
    .gt("expires_at", new Date().toISOString());
  if (!profiles || profiles.length === 0) return { data: [], status: "empty" };
  let mapped = profiles.map(profileRowToNormalized);
  if (minF) mapped = mapped.filter((p: any) => p.followers_count >= minF);
  if (maxF) mapped = mapped.filter((p: any) => p.followers_count <= maxF);
  return { data: mapped, status: "ok" };
}

async function writeSearchCache(
  serviceClient: any,
  userId: string,
  query: string,
  platform: string | null,
  minF: number | null,
  maxF: number | null,
  results: any[],
  status: "ok" | "empty" | "timeout",
  errors: string[] | null = null,
) {
  // TTL: 7 dias para sucesso real, 2h para vazio/timeout
  const ttlMs = status === "ok" && results.length > 0
    ? 7 * 86400 * 1000
    : 2 * 3600 * 1000;
  const expires = new Date(Date.now() + ttlMs).toISOString();
  await serviceClient.from("discovery_searches").insert({
    user_id: userId,
    query_normalized: query,
    platform: platform || "all",
    min_followers: minF,
    max_followers: maxF,
    result_usernames: results.map((r) => ({ username: r.username, platform: r.platform })),
    result_count: results.length,
    status,
    errors: errors && errors.length > 0 ? errors : null,
    expires_at: expires,
  });
}

async function logApifyRun(
  serviceClient: any,
  userId: string | null,
  actorId: string,
  inputSummary: any,
  status: "ok" | "timeout" | "error",
  durationMs: number,
  itemsCount: number,
  error: string | null,
) {
  try {
    await serviceClient.from("apify_run_log").insert({
      user_id: userId,
      actor_id: actorId,
      input_summary: inputSummary,
      status,
      duration_ms: durationMs,
      items_count: itemsCount,
      error,
    });
  } catch (_e) { /* best-effort */ }
}

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
  timeoutSecs = 60,
  serviceClient: any = null,
  userId: string | null = null,
): Promise<any[]> {
  const started = Date.now();
  const url = `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSecs}&memory=2048`;
  const controller = new AbortController();
  // hard kill em timeoutSecs+5 (não deixamos o Apify acumular além do solicitado)
  const t = setTimeout(() => controller.abort(), (timeoutSecs + 5) * 1000);
  const inputSummary = {
    keys: Object.keys(input),
    timeout: timeoutSecs,
    sample: JSON.stringify(input).slice(0, 200),
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text();
      const isTimeout = txt.includes("TIMED-OUT") || txt.includes("TIMEOUT");
      const errMsg = `apify ${actorId} ${res.status}: ${txt.slice(0, 300)}`;
      if (serviceClient) {
        await logApifyRun(
          serviceClient, userId, actorId, inputSummary,
          isTimeout ? "timeout" : "error",
          Date.now() - started, 0, errMsg,
        );
      }
      throw new Error(errMsg);
    }
    const data = await res.json();
    const items = Array.isArray(data) ? data : [];
    if (serviceClient) {
      await logApifyRun(
        serviceClient, userId, actorId, inputSummary,
        "ok", Date.now() - started, items.length, null,
      );
    }
    return items;
  } catch (e) {
    if (serviceClient) {
      const msg = e instanceof Error ? e.message : String(e);
      const isAbort = msg.includes("aborted") || msg.includes("AbortError");
      await logApifyRun(
        serviceClient, userId, actorId, inputSummary,
        isAbort ? "timeout" : "error",
        Date.now() - started, 0, msg,
      );
    }
    throw e;
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
    reason: item.biography ? `Bio: ${String(item.biography).slice(0, 120)}` : "Perfil real Instagram",
    source: "apify_instagram",
    bio: item.biography || null,
    is_verified: Boolean(item.verified),
    is_private: Boolean(item.private),
    business_category: item.businessCategoryName || item.categoryName || null,
    external_url: item.externalUrl || item.externalUrlShimmed || null,
    latest_posts: posts,
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
    reason: "Perfil real TikTok",
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

// === ENRICH MODE ===
async function enrichSingle(
  username: string,
  platform: string,
  apifyToken: string,
  serviceClient: any,
  userId: string | null,
): Promise<NormalizedInfluencer | null> {
  const term = username.replace(/^@/, "");
  if (platform === "tiktok") {
    const items = await runApifyActor("clockworks/tiktok-scraper", {
      profiles: [term],
      resultsPerPage: 12,
      shouldDownloadVideos: false,
    }, apifyToken, 60, serviceClient, userId);
    if (items.length === 0) return null;
    const norm = normalizeTiktokProfile(items[0]);
    if (norm) {
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
  const items = await runApifyActor("apify/instagram-profile-scraper", {
    usernames: [term],
    resultsLimit: 12,
  }, apifyToken, 60, serviceClient, userId);
  if (items.length === 0) return null;
  return normalizeIgProfile(items[0]);
}

// =============================================================
// Estratégias paralelas tolerantes a falhas
// =============================================================
type Strategy = {
  name: string;
  run: () => Promise<NormalizedInfluencer[]>;
};

async function executeWithBudget(
  strategies: Strategy[],
  budgetMs: number,
): Promise<{ results: NormalizedInfluencer[]; errors: string[]; timedOut: boolean }> {
  const results: NormalizedInfluencer[] = [];
  const errors: string[] = [];
  let timedOut = false;

  const budgetPromise = new Promise<"BUDGET_EXCEEDED">((resolve) => {
    setTimeout(() => resolve("BUDGET_EXCEEDED"), budgetMs);
  });

  const runs = strategies.map((s) =>
    s.run()
      .then((r) => ({ ok: true as const, name: s.name, data: r }))
      .catch((e) => ({ ok: false as const, name: s.name, error: e instanceof Error ? e.message : String(e) }))
  );

  const allDone = Promise.allSettled(runs).then(() => "ALL_DONE" as const);

  // Espera o que terminar primeiro: budget ou todos
  const winner = await Promise.race([budgetPromise, allDone]);
  if (winner === "BUDGET_EXCEEDED") {
    timedOut = true;
    errors.push("budget exceeded");
  }

  // Coleta tudo o que já resolveu (estratégias que rolaram dentro do budget)
  const settled = await Promise.allSettled(runs);
  for (const r of settled) {
    if (r.status === "fulfilled") {
      const v = r.value;
      if (v.ok) {
        results.push(...v.data);
      } else {
        errors.push(`${v.name}: ${v.error}`);
      }
    }
  }
  return { results, errors, timedOut };
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
        message: "Fonte oficial não configurada.",
      }), { status: 503, headers: jsonHeaders });
    }

    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const force = body.force === true;

    // ================================================================
    // ENRICH MODE
    // ================================================================
    if (body.action === "enrich") {
      const { username, platform = "instagram" } = body;
      if (!username || typeof username !== "string") {
        return new Response(JSON.stringify({ error: "username obrigatório" }), { status: 400, headers: jsonHeaders });
      }
      if (!force) {
        const cached = await readProfileCache(serviceClient, platform, username.replace(/^@/, ""));
        if (cached) {
          return new Response(JSON.stringify({ data: profileRowToNormalized(cached) }), {
            status: 200, headers: jsonHeaders,
          });
        }
      }
      try {
        const norm = await enrichSingle(username, platform, APIFY_TOKEN, serviceClient, user.id);
        if (!norm) {
          return new Response(JSON.stringify({ data: null, message: "Perfil não encontrado" }), {
            status: 200, headers: jsonHeaders,
          });
        }
        await upsertProfileCacheBatch(serviceClient, [norm], 7);
        return new Response(JSON.stringify({ data: norm }), { status: 200, headers: jsonHeaders });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return new Response(JSON.stringify({ error: "enrich_failed", message: msg }), {
          status: 502, headers: jsonHeaders,
        });
      }
    }

    // ================================================================
    // SEARCH MODE
    // ================================================================
    const { query, platform = "instagram", limit = 10 } = body;
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "Campo 'query' é obrigatório" }), { status: 400, headers: jsonHeaders });
    }

    const trimmed = query.trim();
    const isHashtag = trimmed.startsWith("#");
    const isUsername = trimmed.startsWith("@");
    const term = trimmed.replace(/^[#@]/, "");
    const cleanTerm = term.replace(/\s+/g, "").toLowerCase();
    const limitNum = Math.min(Math.max(Number(limit) || 10, 1), 30);
    const minF = body.min_followers ? Number(body.min_followers) : null;
    const maxF = body.max_followers ? Number(body.max_followers) : null;
    const queryNorm = normalizeQuery(trimmed);

    // Cache HIT (positivo OU negativo)
    if (!force) {
      const cached = await readSearchCache(serviceClient, queryNorm, platform, minF, maxF);
      if (cached) {
        // Cache positivo com itens
        if (cached.data.length > 0) {
          return new Response(JSON.stringify({
            data: cached.data.slice(0, limitNum),
            meta: { source: "cache", count: cached.data.length, query: trimmed, cached: true, status: "ok" },
          }), { status: 200, headers: jsonHeaders });
        }
        // Cache negativo válido — devolve vazio sem chamar Apify
        if (cached.status === "empty" || cached.status === "timeout") {
          return new Response(JSON.stringify({
            data: [],
            meta: {
              source: "cache_negative",
              count: 0,
              query: trimmed,
              cached: true,
              status: cached.status,
              message: cached.status === "timeout"
                ? "Busca anterior expirou. Tente novamente em algumas horas ou force atualização."
                : "Nenhum resultado encontrado anteriormente. Tente outro termo.",
            },
          }), { status: 200, headers: jsonHeaders });
        }
      }
    }

    // ================================================================
    // Monta estratégias por plataforma
    // ================================================================
    const strategies: Strategy[] = [];

    if (platform === "instagram" || platform === "all") {
      // 1) Perfil direto (rápido, ~5-8s) — sempre tenta para @user, #tag, ou termo livre
      strategies.push({
        name: "ig_profile_direct",
        run: async () => {
          const candidates = isUsername || isHashtag
            ? [cleanTerm]
            : [cleanTerm]; // termo livre tenta como handle
          const items = await runApifyActor(
            "apify/instagram-profile-scraper",
            { usernames: candidates, resultsLimit: 12 },
            APIFY_TOKEN, 45, serviceClient, user.id,
          );
          const out: NormalizedInfluencer[] = [];
          for (const it of items) {
            const norm = normalizeIgProfile(it);
            if (norm) {
              if (isHashtag) norm.reason = `Perfil oficial @${norm.username} (mesmo nome da hashtag)`;
              out.push(norm);
            }
          }
          return out;
        },
      });

      // 2) Hashtag scraper — só roda para #tag ou termo livre (não para @user)
      // Timeout AGRESSIVO porque é o ator que mais falha. Resultados pequenos.
      if (!isUsername) {
        strategies.push({
          name: "ig_hashtag",
          run: async () => {
            let posts: any[] = [];
            try {
              posts = await runApifyActor(
                "apify/instagram-hashtag-scraper",
                { hashtags: [cleanTerm], resultsLimit: 10 },
                APIFY_TOKEN, 30, serviceClient, user.id,
              );
            } catch (_e) {
              // Sem fallback caro — se hashtag scraper falhar, desistimos
              return [];
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
              .slice(0, 3) // só top 3 para não estourar budget enriquecendo
              .map((p) => p.ownerUsername)
              .filter((u: string) => u && u !== cleanTerm); // pula o que já vem da estratégia 1

            if (topOwners.length === 0) return [];

            // Enriquecimento em paralelo, cada um com timeout próprio
            const enriched = await Promise.allSettled(
              topOwners.map((u: string) =>
                runApifyActor(
                  "apify/instagram-profile-scraper",
                  { usernames: [u], resultsLimit: 12 },
                  APIFY_TOKEN, 30, serviceClient, user.id,
                )
              )
            );
            const out: NormalizedInfluencer[] = [];
            for (const r of enriched) {
              if (r.status === "fulfilled") {
                for (const it of r.value) {
                  const norm = normalizeIgProfile(it);
                  if (norm) {
                    norm.reason = `Criador ativo na hashtag #${cleanTerm}`;
                    out.push(norm);
                  }
                }
              }
            }
            return out;
          },
        });
      }
    }

    if (platform === "tiktok" || platform === "all") {
      strategies.push({
        name: "tiktok",
        run: async () => {
          const tiktokInput: any = isUsername
            ? { profiles: [cleanTerm], resultsPerPage: 5 }
            : { hashtags: [cleanTerm], resultsPerPage: limitNum };
          const items = await runApifyActor(
            "clockworks/tiktok-scraper",
            tiktokInput, APIFY_TOKEN, 45, serviceClient, user.id,
          );
          const out: NormalizedInfluencer[] = [];
          const seenAuthors = new Set<string>();
          for (const it of items) {
            const norm = normalizeTiktokProfile(it);
            if (norm && !seenAuthors.has(norm.username)) {
              seenAuthors.add(norm.username);
              out.push(norm);
            }
          }
          return out;
        },
      });
    }

    // Executa todas as estratégias com budget global de 25s
    const { results: rawResults, errors, timedOut } = await executeWithBudget(strategies, 25_000);

    let results = dedupe(rawResults)
      .filter((r) => r.username)
      .sort((a, b) => b.followers_count - a.followers_count)
      .slice(0, limitNum);

    // Determina o status do cache a gravar
    let cacheStatus: "ok" | "empty" | "timeout";
    if (results.length > 0) cacheStatus = "ok";
    else if (timedOut || errors.some((e) => e.includes("TIMED-OUT") || e.includes("timeout") || e.includes("aborted"))) cacheStatus = "timeout";
    else cacheStatus = "empty";

    // Persiste em batch (mais rápido e atômico)
    try {
      if (results.length > 0) {
        await upsertProfileCacheBatch(serviceClient, results, 7);
      }
      await writeSearchCache(
        serviceClient, user.id, queryNorm, platform, minF, maxF,
        results, cacheStatus, errors,
      );
    } catch (e) {
      console.error("[apify-influencer-search] cache write failed:", e);
    }

    return new Response(JSON.stringify({
      data: results,
      meta: {
        source: "apify",
        count: results.length,
        errors: errors.length > 0 ? errors : undefined,
        query: trimmed,
        cached: false,
        status: cacheStatus,
        partial: timedOut,
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
