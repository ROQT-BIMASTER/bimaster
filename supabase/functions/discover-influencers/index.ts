import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const PHYLLO_BASE = "https://api.getphyllo.com/v1";

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

    // Phyllo credentials
    const clientId = Deno.env.get("PHYLLO_CLIENT_ID");
    const clientSecret = Deno.env.get("PHYLLO_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({
        error: "phyllo_not_configured",
        message: "Credenciais Phyllo não configuradas.",
      }), { status: 503, headers: jsonHeaders });
    }

    const authToken = btoa(`${clientId}:${clientSecret}`);

    const body = await req.json();
    const { query, platform, min_followers, max_followers } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Campo 'query' é obrigatório" }), {
        status: 400, headers: jsonHeaders,
      });
    }

    // Use Phyllo Search API to discover influencers
    const searchUrl = new URL(`${PHYLLO_BASE}/social/creators/search`);

    const searchBody: Record<string, unknown> = {
      name: query.trim(),
      limit: 20,
    };

    if (platform && platform !== "all") {
      searchBody.work_platform_id = getPlatformId(platform);
    }

    if (min_followers) {
      searchBody.min_follower_count = Number(min_followers);
    }
    if (max_followers) {
      searchBody.max_follower_count = Number(max_followers);
    }

    const searchRes = await fetch(searchUrl.toString(), {
      method: "POST",
      headers: {
        Authorization: `Basic ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(searchBody),
    });

    const searchData = await searchRes.json();

    if (!searchRes.ok) {
      console.error("Phyllo search error:", JSON.stringify(searchData));
      
      // Fallback: try identity search if creator search fails
      const identityUrl = new URL(`${PHYLLO_BASE}/social/accounts`);
      identityUrl.searchParams.set("limit", "20");
      
      const identityRes = await fetch(identityUrl.toString(), {
        headers: { Authorization: `Basic ${authToken}` },
      });
      
      if (!identityRes.ok) {
        return new Response(JSON.stringify({
          error: "search_failed",
          message: "Não foi possível buscar influenciadores. Verifique suas credenciais Phyllo.",
          details: searchData,
        }), { status: 502, headers: jsonHeaders });
      }
      
      const identityData = await identityRes.json();
      const results = mapPhylloResults(identityData.data || []);
      return new Response(JSON.stringify({ data: results, source: "identity" }), {
        status: 200, headers: jsonHeaders,
      });
    }

    const results = mapPhylloCreatorResults(searchData.data || []);

    return new Response(JSON.stringify({ data: results, source: "search" }), {
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

function getPlatformId(platform: string): string | undefined {
  const map: Record<string, string> = {
    instagram: "9bb8913b-ddd9-430b-a66a-d74d846e6c66",
    tiktok: "de55aeec-0dc8-4119-bf90-16b3d1f0c987",
    youtube: "14d9ddf5-51c0-4f76-b0f7-3011a55b8e28",
    twitter: "7645460a-96e3-4224-8cd7-78a75c7e3b3e",
    facebook: "7cd0e820-4d59-4c24-a0a5-4b2f32284840",
    linkedin: "a]", // LinkedIn may not be supported
  };
  return map[platform];
}

function mapPhylloCreatorResults(data: unknown[]): unknown[] {
  return data.map((item: any) => ({
    username: item.username || item.platform_username || "unknown",
    display_name: item.full_name || item.name || item.username || "",
    platform: item.work_platform?.name?.toLowerCase() || item.platform || "instagram",
    profile_url: item.url || item.profile_url || null,
    avatar_url: item.image_url || item.picture || null,
    followers_count: item.follower_count || item.subscriber_count || 0,
    engagement_rate: item.engagement_rate || 0,
    avg_likes: item.average_likes || 0,
    avg_comments: item.average_comments || 0,
    niche: item.category || item.niche || null,
    reason: item.bio || item.introduction || "Encontrado via Phyllo Search",
  }));
}

function mapPhylloResults(data: unknown[]): unknown[] {
  return data.map((item: any) => ({
    username: item.username || item.platform_username || "unknown",
    display_name: item.full_name || item.first_name || item.username || "",
    platform: item.work_platform?.name?.toLowerCase() || "instagram",
    profile_url: item.url || null,
    avatar_url: item.image_url || item.profile_pic_url || null,
    followers_count: item.follower_count || 0,
    engagement_rate: item.engagement_rate || 0,
    avg_likes: 0,
    avg_comments: 0,
    niche: item.category || null,
    reason: item.introduction || "Encontrado via Phyllo",
  }));
}
