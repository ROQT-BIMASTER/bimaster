// Apify Sync Influencer
// Atualiza um influenciador com dados frescos da Apify e faz upsert dos últimos 12 posts.
// Pode ser chamado para 1 influenciador ou em batch (lista de IDs).

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface SyncResult {
  influencer_id: string;
  ok: boolean;
  updated_fields?: string[];
  posts_upserted?: number;
  error?: string;
}

async function syncOne(
  influencerId: string,
  serviceClient: any,
  supabaseUrl: string,
  authHeader: string,
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

  // 2. Chama apify-influencer-search em modo enrich
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

  // 3. Update do influenciador com campos enriquecidos
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

  // 4. Upsert dos posts recentes (idempotente via uniq_influencer_posts_platform_id)
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

  return {
    influencer_id: influencerId,
    ok: true,
    updated_fields: Object.keys(updates),
    posts_upserted: postsUpserted,
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

    // Sequencial — cada perfil leva ~10s; paralelizar estoura limites do Apify
    const results: SyncResult[] = [];
    for (const id of ids) {
      try {
        const r = await syncOne(id, serviceClient, supabaseUrl, authHeader);
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

    return new Response(JSON.stringify({
      data: {
        results,
        summary: {
          total: results.length,
          succeeded: okCount,
          failed: results.length - okCount,
          posts_upserted: totalPosts,
        },
      },
    }), { status: 200, headers: jsonHeaders });

  } catch (error) {
    console.error("apify-sync-influencer error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: "internal_error", message }), {
      status: 500, headers: jsonHeaders,
    });
  }
});
