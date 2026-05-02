// Apify Sync Influencer
// Atualiza um influenciador com dados frescos da Apify, faz upsert dos últimos posts
// e coleta comentários reais via Apify (instagram-comment-scraper / tiktok-comments-scraper).
// Após gravar comentários, encadeia análise de sentimento (analyze-comments-sentiment).
// Pode ser chamado para 1 influenciador ou em batch (lista de IDs).

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface SyncResult {
  influencer_id: string;
  ok: boolean;
  updated_fields?: string[];
  posts_upserted?: number;
  comments_upserted?: number;
  sentiment_analyzed?: number;
  error?: string;
}

const APIFY_BASE = "https://api.apify.com/v2";

// =============================================================
// Apify actor runner com timeout + auditoria em apify_run_log
// =============================================================
async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>,
  token: string,
  timeoutSecs: number,
  serviceClient: any,
  userId: string | null,
): Promise<any[]> {
  const started = Date.now();
  const url = `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSecs}&memory=2048`;
  const controller = new AbortController();
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
      try {
        await serviceClient.from("apify_run_log").insert({
          user_id: userId,
          actor_id: actorId,
          input_summary: inputSummary,
          status: isTimeout ? "timeout" : "error",
          duration_ms: Date.now() - started,
          items_count: 0,
          error: errMsg,
        });
      } catch (_e) { /* best-effort */ }
      throw new Error(errMsg);
    }
    const data = await res.json();
    const items = Array.isArray(data) ? data : [];
    try {
      await serviceClient.from("apify_run_log").insert({
        user_id: userId,
        actor_id: actorId,
        input_summary: inputSummary,
        status: "ok",
        duration_ms: Date.now() - started,
        items_count: items.length,
        error: null,
      });
    } catch (_e) { /* best-effort */ }
    return items;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isAbort = msg.includes("aborted") || msg.includes("AbortError");
    try {
      await serviceClient.from("apify_run_log").insert({
        user_id: userId,
        actor_id: actorId,
        input_summary: inputSummary,
        status: isAbort ? "timeout" : "error",
        duration_ms: Date.now() - started,
        items_count: 0,
        error: msg,
      });
    } catch (_e) { /* best-effort */ }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// =============================================================
// Coleta comentários reais via Apify
// =============================================================
async function collectComments(
  platform: string,
  posts: { id: string; post_url: string | null; platform_post_id: string | null }[],
  apifyToken: string,
  serviceClient: any,
  userId: string | null,
  maxPosts = 5,
  maxCommentsPerPost = 30,
): Promise<number> {
  const top = posts
    .filter((p) => !!p.post_url && !!p.id)
    .slice(0, maxPosts);
  if (top.length === 0) return 0;

  let inserted = 0;

  if (platform === "instagram") {
    // apify/instagram-comment-scraper aceita directUrls
    let items: any[] = [];
    try {
      items = await runApifyActor(
        "apify/instagram-comment-scraper",
        {
          directUrls: top.map((p) => p.post_url),
          resultsLimit: maxCommentsPerPost,
        },
        apifyToken,
        90,
        serviceClient,
        userId,
      );
    } catch (_e) {
      // log já gravado; segue sem comentários
      return 0;
    }

    // Agrupa comentários por post via campo postUrl/postShortcode
    for (const item of items) {
      const pUrl: string | null = item.postUrl || item.url || null;
      const pShort: string | null = item.shortCode || item.shortcode || null;
      const target = top.find((p) => {
        if (pUrl && p.post_url && p.post_url.includes(pUrl.replace(/\/$/, ""))) return true;
        if (pShort && p.platform_post_id === pShort) return true;
        if (pShort && p.post_url && p.post_url.includes(pShort)) return true;
        return false;
      });
      if (!target) continue;

      const text = String(item.text || item.commentText || "").trim();
      if (!text) continue;
      const author = item.ownerUsername || item.owner?.username || item.username || "unknown";

      const { error } = await serviceClient.from("influencer_comments").insert({
        post_id: target.id,
        author_username: author,
        comment_text: text.slice(0, 2000),
        sentiment: null, // será classificado depois
        sentiment_score: null,
        is_spam: false,
        source: "apify",
      });
      if (!error) inserted++;
    }
  } else if (platform === "tiktok") {
    // clockworks/tiktok-comments-scraper aceita postURLs
    let items: any[] = [];
    try {
      items = await runApifyActor(
        "clockworks/tiktok-comments-scraper",
        {
          postURLs: top.map((p) => p.post_url),
          commentsPerPost: maxCommentsPerPost,
        },
        apifyToken,
        90,
        serviceClient,
        userId,
      );
    } catch (_e) {
      return 0;
    }

    for (const item of items) {
      const pUrl: string | null = item.videoWebUrl || item.postUrl || null;
      const target = top.find((p) =>
        pUrl && p.post_url && p.post_url.includes(pUrl.split("?")[0])
      ) || top[0];
      if (!target) continue;

      const text = String(item.text || "").trim();
      if (!text) continue;
      const author = item.uniqueId || item.user?.uniqueId || "unknown";

      const { error } = await serviceClient.from("influencer_comments").insert({
        post_id: target.id,
        author_username: author,
        comment_text: text.slice(0, 2000),
        sentiment: null,
        sentiment_score: null,
        is_spam: false,
        source: "apify",
      });
      if (!error) inserted++;
    }
  }

  return inserted;
}

// =============================================================
// Sync principal de 1 influenciador
// =============================================================
async function syncOne(
  influencerId: string,
  serviceClient: any,
  supabaseUrl: string,
  authHeader: string,
  apifyToken: string,
  userId: string,
): Promise<SyncResult> {
  // 1. Carrega influenciador
  const { data: inf, error: infErr } = await serviceClient
    .from("influencers")
    .select("id, user_id, platform, username")
    .eq("id", influencerId)
    .single();

  if (infErr || !inf) {
    return { influencer_id: influencerId, ok: false, error: "not_found" };
  }

  // 2. Chama apify-influencer-search em modo enrich (perfil + 12 posts)
  const enrichRes = await fetch(`${supabaseUrl}/functions/v1/apify-influencer-search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      action: "enrich",
      username: inf.username,
      platform: inf.platform,
    }),
  });

  if (!enrichRes.ok) {
    const txt = await enrichRes.text();
    return { influencer_id: influencerId, ok: false, error: `enrich_${enrichRes.status}: ${txt.slice(0, 200)}` };
  }

  const { data: enriched } = await enrichRes.json();
  if (!enriched) {
    return { influencer_id: influencerId, ok: false, error: "no_data" };
  }

  // 3. Update do influenciador
  const updates: Record<string, any> = {
    display_name: enriched.display_name || null,
    avatar_url: enriched.avatar_url || null,
    followers_count: enriched.followers_count || 0,
    engagement_rate: enriched.engagement_rate || 0,
    avg_likes: enriched.avg_likes || 0,
    avg_comments: enriched.avg_comments || 0,
    bio: enriched.bio || null,
    is_verified: Boolean(enriched.is_verified),
    is_private: Boolean(enriched.is_private),
    business_category: enriched.business_category || null,
    external_url: enriched.external_url || null,
    posts_count: enriched.posts_count || null,
    following_count: enriched.following_count || null,
    profile_url: enriched.profile_url || null,
    data_source: "apify",
    last_synced_at: new Date().toISOString(),
  };

  const { error: updErr } = await serviceClient
    .from("influencers")
    .update(updates)
    .eq("id", influencerId);

  if (updErr) {
    return { influencer_id: influencerId, ok: false, error: `update_failed: ${updErr.message}` };
  }

  // 4. Upsert dos posts recentes (idempotente)
  let postsUpserted = 0;
  if (Array.isArray(enriched.latest_posts) && enriched.latest_posts.length > 0) {
    const rows = enriched.latest_posts
      .filter((p: any) => p.platform_post_id)
      .map((p: any) => ({
        influencer_id: influencerId,
        user_id: inf.user_id,
        platform_post_id: p.platform_post_id,
        post_url: p.post_url,
        post_type: p.post_type,
        caption: p.caption,
        thumbnail_url: p.thumbnail_url,
        media_url: p.media_url,
        likes: p.likes || 0,
        comments_count: p.comments_count || 0,
        shares: p.shares || 0,
        posted_at: p.posted_at,
        source: "apify",
      }));

    if (rows.length > 0) {
      const { error: upErr, count } = await serviceClient
        .from("influencer_posts")
        .upsert(rows, {
          onConflict: "influencer_id,platform_post_id",
          count: "exact",
        });
      if (!upErr) postsUpserted = count || rows.length;
    }
  }

  // 5. Coleta comentários reais via Apify (top 5 posts mais recentes)
  let commentsUpserted = 0;
  let sentimentAnalyzed = 0;
  if (postsUpserted > 0 && (inf.platform === "instagram" || inf.platform === "tiktok")) {
    // Recarrega os IDs internos dos posts mais recentes
    const { data: recentPosts } = await serviceClient
      .from("influencer_posts")
      .select("id, post_url, platform_post_id")
      .eq("influencer_id", influencerId)
      .eq("source", "apify")
      .order("posted_at", { ascending: false, nullsFirst: false })
      .limit(5);

    if (recentPosts && recentPosts.length > 0) {
      try {
        commentsUpserted = await collectComments(
          inf.platform,
          recentPosts,
          apifyToken,
          serviceClient,
          userId,
          5,
          30,
        );
      } catch (e) {
        logger.warn("comment collection failed:", e instanceof Error ? e.message : e);
      }

      // 6. Encadeia análise de sentimento (best-effort, não bloqueia o retorno)
      if (commentsUpserted > 0) {
        try {
          const senRes = await fetch(`${supabaseUrl}/functions/v1/analyze-comments-sentiment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader,
            },
            body: JSON.stringify({ influencerId }),
          });
          if (senRes.ok) {
            const senJson = await senRes.json().catch(() => ({}));
            sentimentAnalyzed = Number(senJson.analyzed || 0);
          }
        } catch (e) {
          logger.warn("sentiment analysis failed:", e instanceof Error ? e.message : e);
        }
      }
    }
  }

  return {
    influencer_id: influencerId,
    ok: true,
    updated_fields: Object.keys(updates),
    posts_upserted: postsUpserted,
    comments_upserted: commentsUpserted,
    sentiment_analyzed: sentimentAnalyzed,
  };
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

    const apifyToken = Deno.env.get("APIFY_API_TOKEN");
    if (!apifyToken) {
      return new Response(JSON.stringify({ error: "APIFY_API_TOKEN não configurado" }), {
        status: 503, headers: jsonHeaders,
      });
    }

    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json();
    const { influencer_id, influencer_ids } = body;

    let ids: string[] = [];
    if (typeof influencer_id === "string") ids = [influencer_id];
    else if (Array.isArray(influencer_ids)) ids = influencer_ids.filter((x: any) => typeof x === "string");

    if (ids.length === 0) {
      return new Response(JSON.stringify({ error: "informe influencer_id ou influencer_ids" }), {
        status: 400, headers: jsonHeaders,
      });
    }

    if (ids.length > 25) {
      return new Response(JSON.stringify({ error: "máximo 25 por chamada" }), {
        status: 400, headers: jsonHeaders,
      });
    }

    // Sequencial — paralelizar estoura limites do Apify
    const results: SyncResult[] = [];
    for (const id of ids) {
      try {
        const r = await syncOne(id, serviceClient, supabaseUrl, authHeader, apifyToken, user.id);
        results.push(r);
      } catch (e) {
        results.push({
          influencer_id: id,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    const totalPosts = results.reduce((s, r) => s + (r.posts_upserted || 0), 0);
    const totalComments = results.reduce((s, r) => s + (r.comments_upserted || 0), 0);
    const totalSentiment = results.reduce((s, r) => s + (r.sentiment_analyzed || 0), 0);

    return new Response(JSON.stringify({
      data: {
        results,
        summary: {
          total: results.length,
          succeeded: okCount,
          failed: results.length - okCount,
          posts_upserted: totalPosts,
          comments_upserted: totalComments,
          sentiment_analyzed: totalSentiment,
        },
      },
    }), { status: 200, headers: jsonHeaders });

  } catch (error) {
    logger.error("apify-sync-influencer error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: "internal_error", message }), {
      status: 500, headers: jsonHeaders,
    });
  }
});
