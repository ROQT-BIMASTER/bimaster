import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PHYLLO_BASE = "https://api.getphyllo.com/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: jsonHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: jsonHeaders });
    }

    const body = await req.json();
    const { post_id } = body;

    if (!post_id) {
      return new Response(JSON.stringify({ error: "post_id obrigatório" }), { status: 400, headers: jsonHeaders });
    }

    // Get post from DB
    const { data: post, error: postError } = await supabase
      .from("influencer_posts")
      .select("*, influencers!inner(platform, phyllo_account_id)")
      .eq("id", post_id)
      .single();

    if (postError || !post) {
      return new Response(JSON.stringify({ error: "Post não encontrado" }), { status: 404, headers: jsonHeaders });
    }

    const phylloClientId = Deno.env.get("PHYLLO_CLIENT_ID");
    const phylloClientSecret = Deno.env.get("PHYLLO_CLIENT_SECRET");

    // Strategy 1: Try Phyllo API if we have platform_post_id and credentials
    if (post.platform_post_id && phylloClientId && phylloClientSecret) {
      const authToken = btoa(`${phylloClientId}:${phylloClientSecret}`);

      try {
        // Try fetching the specific content item from Phyllo
        const phylloRes = await fetch(
          `${PHYLLO_BASE}/social/contents/${post.platform_post_id}`,
          {
            headers: {
              Authorization: `Basic ${authToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (phylloRes.ok) {
          const contentData = await phylloRes.json();

          // Extract media URLs from Phyllo response
          const mediaUrl = contentData.media_url || contentData.thumbnail_url || null;
          const thumbnailUrl = contentData.thumbnail_url || contentData.media_url || null;

          if (mediaUrl || thumbnailUrl) {
            // Update DB with fresh URLs
            const serviceClient = createClient(
              supabaseUrl,
              Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
            );

            await serviceClient
              .from("influencer_posts")
              .update({
                thumbnail_url: thumbnailUrl,
                post_url: contentData.url || post.post_url,
              })
              .eq("id", post_id);

            return new Response(JSON.stringify({
              media_url: mediaUrl,
              thumbnail_url: thumbnailUrl,
              post_url: contentData.url || post.post_url,
              source: "phyllo",
            }), { headers: jsonHeaders });
          }
        } else {
          const errorText = await phylloRes.text();
          console.warn(`Phyllo content fetch failed [${phylloRes.status}]:`, errorText);
        }
      } catch (phylloErr) {
        console.warn("Phyllo API error:", phylloErr);
      }
    }

    // Strategy 2: Try to get content list from Phyllo for this account
    const influencerData = post.influencers as any;
    if (influencerData?.phyllo_account_id && phylloClientId && phylloClientSecret) {
      const authToken = btoa(`${phylloClientId}:${phylloClientSecret}`);

      try {
        const listRes = await fetch(
          `${PHYLLO_BASE}/social/contents?account_id=${influencerData.phyllo_account_id}&limit=50`,
          {
            headers: {
              Authorization: `Basic ${authToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (listRes.ok) {
          const listData = await listRes.json();
          const items = listData.data || [];

          // Match by external_id or URL
          const match = items.find((item: any) =>
            item.external_id === post.platform_post_id ||
            (post.post_url && item.url && item.url === post.post_url)
          );

          if (match) {
            const mediaUrl = match.media_url || match.thumbnail_url || null;
            const thumbnailUrl = match.thumbnail_url || match.media_url || null;

            if (mediaUrl || thumbnailUrl) {
              const serviceClient = createClient(
                supabaseUrl,
                Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
              );

              await serviceClient
                .from("influencer_posts")
                .update({
                  thumbnail_url: thumbnailUrl,
                  platform_post_id: match.id || post.platform_post_id,
                  post_url: match.url || post.post_url,
                })
                .eq("id", post_id);

              return new Response(JSON.stringify({
                media_url: mediaUrl,
                thumbnail_url: thumbnailUrl,
                post_url: match.url || post.post_url,
                source: "phyllo_list",
              }), { headers: jsonHeaders });
            }
          }
        }
      } catch (listErr) {
        console.warn("Phyllo list error:", listErr);
      }
    }

    // Strategy 3: Return existing URLs (even if expired, client will handle fallback)
    return new Response(JSON.stringify({
      media_url: post.thumbnail_url || post.post_url || null,
      thumbnail_url: post.thumbnail_url || null,
      post_url: post.post_url || null,
      source: "cached",
    }), { headers: jsonHeaders });

  } catch (err) {
    console.error("resolve-post-media error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: jsonHeaders });
  }
});
