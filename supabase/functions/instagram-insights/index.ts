import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { secureHandler } from "../_shared/secure-handler.ts";

Deno.serve(secureHandler({
  auth: "none",
  rateLimit: 60,
  rateLimitPrefix: "instagram-insights",
}, async (req, _ctx) => {

  const headers = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { accountId, action } = body;

    if (!accountId || !action) {
      return new Response(JSON.stringify({ error: "accountId e action são obrigatórios" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const validActions = ["get_recent_media", "get_stories", "get_reels", "get_audience_insights", "get_growth"];
    if (!validActions.includes(action)) {
      return new Response(JSON.stringify({ error: `Ação inválida. Use: ${validActions.join(", ")}` }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch account and verify ownership
    const { data: account, error: accError } = await supabase
      .from("social_media_accounts")
      .select("id, platform, username, access_token_encrypted, app_id, app_secret_encrypted, user_id")
      .eq("id", accountId)
      .single();

    if (accError || !account) {
      return new Response(JSON.stringify({ error: "Conta não encontrada" }), {
        status: 404,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (account.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (account.platform !== "instagram") {
      return new Response(JSON.stringify({ error: "Esta função é exclusiva para contas Instagram" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // Decrypt token
    const { data: accessToken, error: decryptError } = await supabase.rpc("decrypt_token", {
      p_encrypted: account.access_token_encrypted,
    });

    if (decryptError || !accessToken) {
      return new Response(JSON.stringify({ error: "Erro ao decriptar token" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // Try token exchange for long-lived token
    let token = accessToken;
    const metaAppId = Deno.env.get("META_APP_ID");
    const metaAppSecret = Deno.env.get("META_APP_SECRET");

    if (metaAppId && metaAppSecret) {
      try {
        const exchangeUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${metaAppId}&client_secret=${metaAppSecret}&fb_exchange_token=${token}`;
        const exchangeRes = await fetch(exchangeUrl);
        if (exchangeRes.ok) {
          const exchangeData = await exchangeRes.json();
          if (exchangeData.access_token && exchangeData.access_token !== token) {
            console.log("Token exchanged for long-lived token");
            const { data: newEncrypted } = await supabase.rpc("encrypt_token", { p_token: exchangeData.access_token });
            if (newEncrypted) {
              await supabase.from("social_media_accounts").update({ access_token_encrypted: newEncrypted }).eq("id", accountId);
            }
            token = exchangeData.access_token;
          }
        }
      } catch (e) {
        console.error("Token exchange error (non-fatal):", e);
      }
    }

    // Resolve IG Business Account ID (try direct first, then FB Pages fallback)
    let igUserId = await resolveIgUserId(token);

    let result;
    switch (action) {
      case "get_recent_media":
        result = await getRecentMedia(igUserId, token);
        break;
      case "get_stories":
        result = await getStories(igUserId, token);
        break;
      case "get_reels":
        result = await getReels(igUserId, token);
        break;
      case "get_audience_insights":
        result = await getAudienceInsights(igUserId, token);
        break;
      case "get_growth":
        result = await getGrowth(igUserId, token);
        break;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("instagram-insights error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Erro interno" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

async function resolveIgUserId(token: string): Promise<string> {
  // Try direct Instagram endpoint
  const directRes = await fetch(
    `https://graph.instagram.com/me?fields=id&access_token=${token}`
  );
  if (directRes.ok) {
    const data = await directRes.json();
    return data.id;
  }

  // Fallback: via Facebook Pages
  const pagesRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?fields=id,instagram_business_account{id}&access_token=${token}`
  );
  if (!pagesRes.ok) {
    throw new Error("Não foi possível resolver a conta Instagram. Verifique as permissões do token.");
  }
  const pagesData = await pagesRes.json();
  const page = pagesData.data?.find((p: any) => p.instagram_business_account);
  if (!page?.instagram_business_account?.id) {
    throw new Error("Nenhuma conta Instagram Business vinculada encontrada.");
  }
  return page.instagram_business_account.id;
}

async function getRecentMedia(igUserId: string, token: string) {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=25&access_token=${token}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Erro ao buscar posts: ${err?.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return {
    posts: (data.data || []).map((post: any) => ({
      id: post.id,
      caption: post.caption || "",
      media_type: post.media_type,
      media_url: post.media_url || post.thumbnail_url || null,
      thumbnail_url: post.thumbnail_url || post.media_url || null,
      permalink: post.permalink,
      timestamp: post.timestamp,
      likes: post.like_count || 0,
      comments: post.comments_count || 0,
    })),
  };
}

async function getStories(igUserId: string, token: string) {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}/stories?fields=id,media_type,media_url,timestamp&access_token=${token}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // Stories may return empty if none active — not an error
    if (res.status === 400) {
      return { stories: [], message: "Nenhum story ativo no momento" };
    }
    throw new Error(`Erro ao buscar stories: ${err?.error?.message || res.statusText}`);
  }
  const data = await res.json();

  // Fetch insights for each story
  const stories = await Promise.all(
    (data.data || []).map(async (story: any) => {
      let insights = { impressions: 0, reach: 0, replies: 0 };
      try {
        const insightRes = await fetch(
          `https://graph.facebook.com/v19.0/${story.id}/insights?metric=impressions,reach,replies&access_token=${token}`
        );
        if (insightRes.ok) {
          const insightData = await insightRes.json();
          insightData.data?.forEach((m: any) => {
            if (m.name === "impressions") insights.impressions = m.values?.[0]?.value || 0;
            if (m.name === "reach") insights.reach = m.values?.[0]?.value || 0;
            if (m.name === "replies") insights.replies = m.values?.[0]?.value || 0;
          });
        }
      } catch (e) {
        console.error("Story insight fetch error:", e);
      }
      return {
        id: story.id,
        media_type: story.media_type,
        media_url: story.media_url || null,
        timestamp: story.timestamp,
        ...insights,
      };
    })
  );

  return { stories };
}

async function getReels(igUserId: string, token: string) {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=25&access_token=${token}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Erro ao buscar reels: ${err?.error?.message || res.statusText}`);
  }
  const data = await res.json();

  // Filter only VIDEO/REELS
  const reels = (data.data || [])
    .filter((m: any) => m.media_type === "VIDEO")
    .map((reel: any) => ({
      id: reel.id,
      caption: reel.caption || "",
      media_url: reel.media_url || reel.thumbnail_url || null,
      thumbnail_url: reel.thumbnail_url || null,
      permalink: reel.permalink,
      timestamp: reel.timestamp,
      likes: reel.like_count || 0,
      comments: reel.comments_count || 0,
    }));

  return { reels };
}

async function getAudienceInsights(igUserId: string, token: string) {
  const metrics = "audience_gender_age,audience_city,audience_country";
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}/insights?metric=${metrics}&period=lifetime&access_token=${token}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Erro ao buscar audiência: ${err?.error?.message || res.statusText}. Verifique se o token possui a permissão instagram_manage_insights.`
    );
  }
  const data = await res.json();

  const result: any = { gender_age: {}, cities: {}, countries: {} };

  data.data?.forEach((metric: any) => {
    const values = metric.values?.[0]?.value || {};
    if (metric.name === "audience_gender_age") result.gender_age = values;
    if (metric.name === "audience_city") result.cities = values;
    if (metric.name === "audience_country") result.countries = values;
  });

  return result;
}

async function getGrowth(igUserId: string, token: string) {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}/insights?metric=follower_count&period=day&since=${Math.floor(Date.now() / 1000) - 30 * 86400}&until=${Math.floor(Date.now() / 1000)}&access_token=${token}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Erro ao buscar crescimento: ${err?.error?.message || res.statusText}. Verifique se o token possui a permissão instagram_manage_insights.`
    );
  }
  const data = await res.json();

  const followerMetric = data.data?.find((m: any) => m.name === "follower_count");
  const growth = (followerMetric?.values || []).map((v: any) => ({
    date: v.end_time,
    followers: v.value || 0,
  }));

  return { growth };
}
