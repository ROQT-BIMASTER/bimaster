import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PHYLLO_BASE = "https://api.getphyllo.com/v1";
const STORAGE_BUCKET = "post-media";

async function downloadAndUploadMedia(
  serviceClient: any,
  mediaUrl: string,
  influencerId: string,
  postId: string
): Promise<string | null> {
  try {
    const res = await fetch(mediaUrl, { redirect: "follow" });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const blob = await res.blob();
    if (blob.size < 1000) return null; // Too small, likely error page

    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const storagePath = `${influencerId}/${postId}.${ext}`;

    const arrayBuffer = await blob.arrayBuffer();
    const { error: uploadError } = await serviceClient.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.warn("Upload error:", uploadError);
      return null;
    }

    return storagePath;
  } catch (e) {
    console.warn("Download/upload failed:", e);
    return null;
  }
}

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

    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // If thumbnail_url is already a storage path (no http), generate signed URL
    if (post.thumbnail_url && !post.thumbnail_url.startsWith("http") && !post.thumbnail_url.startsWith("data:")) {
      const { data: signedData } = await serviceClient.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(post.thumbnail_url, 3600);

      if (signedData?.signedUrl) {
        return new Response(JSON.stringify({
          media_url: signedData.signedUrl,
          thumbnail_url: signedData.signedUrl,
          post_url: post.post_url,
          source: "storage",
        }), { headers: jsonHeaders });
      }
    }

    const phylloClientId = Deno.env.get("PHYLLO_CLIENT_ID");
    const phylloClientSecret = Deno.env.get("PHYLLO_CLIENT_SECRET");

    // Strategy 1: Try Phyllo API if we have platform_post_id and credentials
    if (post.platform_post_id && phylloClientId && phylloClientSecret) {
      const authToken = btoa(`${phylloClientId}:${phylloClientSecret}`);

      try {
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
          const mediaUrl = contentData.media_url || contentData.thumbnail_url || null;

          if (mediaUrl) {
            // Download and persist to Storage
            const storagePath = await downloadAndUploadMedia(
              serviceClient, mediaUrl, post.influencer_id, post_id
            );

            if (storagePath) {
              await serviceClient
                .from("influencer_posts")
                .update({ thumbnail_url: storagePath, post_url: contentData.url || post.post_url })
                .eq("id", post_id);

              const { data: signedData } = await serviceClient.storage
                .from(STORAGE_BUCKET)
                .createSignedUrl(storagePath, 3600);

              return new Response(JSON.stringify({
                media_url: signedData?.signedUrl || mediaUrl,
                thumbnail_url: signedData?.signedUrl || mediaUrl,
                post_url: contentData.url || post.post_url,
                source: "phyllo_stored",
              }), { headers: jsonHeaders });
            }
          }
        }
      } catch (phylloErr) {
        console.warn("Phyllo API error:", phylloErr);
      }
    }

    // Strategy 2: Try content list from Phyllo
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

          const match = items.find((item: any) =>
            item.external_id === post.platform_post_id ||
            (post.post_url && item.url && item.url === post.post_url)
          );

          if (match) {
            const mediaUrl = match.media_url || match.thumbnail_url || null;

            if (mediaUrl) {
              const storagePath = await downloadAndUploadMedia(
                serviceClient, mediaUrl, post.influencer_id, post_id
              );

              if (storagePath) {
                await serviceClient
                  .from("influencer_posts")
                  .update({
                    thumbnail_url: storagePath,
                    platform_post_id: match.id || post.platform_post_id,
                    post_url: match.url || post.post_url,
                  })
                  .eq("id", post_id);

                const { data: signedData } = await serviceClient.storage
                  .from(STORAGE_BUCKET)
                  .createSignedUrl(storagePath, 3600);

                return new Response(JSON.stringify({
                  media_url: signedData?.signedUrl || mediaUrl,
                  thumbnail_url: signedData?.signedUrl || mediaUrl,
                  post_url: match.url || post.post_url,
                  source: "phyllo_list_stored",
                }), { headers: jsonHeaders });
              }
            }
          }
        }
      } catch (listErr) {
        console.warn("Phyllo list error:", listErr);
      }
    }

    // Strategy 3: Return existing URLs (fallback)
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
