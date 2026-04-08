import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-3-flash-preview";
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
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI não configurada" }), { status: 503, headers: jsonHeaders });
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: jsonHeaders });
    }

    const body = await req.json();
    const { influencer_id } = body;

    if (!influencer_id) {
      return new Response(JSON.stringify({ error: "influencer_id obrigatório" }), { status: 400, headers: jsonHeaders });
    }

    const { data: influencer, error: infError } = await supabase
      .from("influencers")
      .select("*")
      .eq("id", influencer_id)
      .eq("user_id", user.id)
      .single();

    if (infError || !influencer) {
      return new Response(JSON.stringify({ error: "Influenciador não encontrado" }), { status: 404, headers: jsonHeaders });
    }

    // Try Phyllo first
    const clientId = Deno.env.get("PHYLLO_CLIENT_ID");
    const clientSecret = Deno.env.get("PHYLLO_CLIENT_SECRET");
    let posts: any[] = [];
    let source = "ai";
    let phylloAccountId: string | null = null;

    if (clientId && clientSecret) {
      try {
        const authToken = btoa(`${clientId}:${clientSecret}`);
        const phylloAuth = { Authorization: `Basic ${authToken}` };

        // Search for the profile on Phyllo
        const searchRes = await fetch(`${PHYLLO_BASE}/social/creators/search`, {
          method: "POST",
          headers: { ...phylloAuth, "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: influencer.platform === "twitter" ? "X" : influencer.platform.charAt(0).toUpperCase() + influencer.platform.slice(1),
            username: influencer.username,
          }),
        });

        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.data?.length > 0) {
            const phylloProfile = searchData.data[0];
            phylloAccountId = phylloProfile.account_id;

            // Update avatar if available
            if (phylloProfile.image_url && !influencer.avatar_url) {
              await supabase
                .from("influencers")
                .update({ avatar_url: phylloProfile.image_url })
                .eq("id", influencer_id);
            }

            // Get content
            if (phylloAccountId) {
              const contentRes = await fetch(
                `${PHYLLO_BASE}/social/content/search?account_id=${phylloAccountId}&limit=20`,
                { headers: phylloAuth }
              );

              if (contentRes.ok) {
                const contentData = await contentRes.json();
                const contentItems = contentData.data || [];

                posts = contentItems.map((item: any) => ({
                  platform_post_id: item.id,
                  post_url: item.url,
                  post_type: item.type || "image",
                  caption: item.title || item.description,
                  thumbnail_url: item.thumbnail_url || item.media_url,
                  likes: item.engagement?.like_count || 0,
                  comments_count: item.engagement?.comment_count || 0,
                  shares: item.engagement?.share_count || 0,
                  posted_at: item.published_at,
                  _phyllo_content_id: item.id, // keep for fetching comments
                }));
                source = "phyllo";
              }
            }
          }
        }
      } catch (e) {
        console.error("Phyllo fetch failed, falling back to AI:", e);
      }
    }

    // Fallback: use AI to estimate content
    if (posts.length === 0) {
      const aiResponse = await fetch(AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            {
              role: "system",
              content: `Você é um pesquisador de redes sociais. A DATA DE HOJE É ${new Date().toISOString().substring(0, 10)}. Pesquise posts REAIS e recentes do influenciador fornecido. Retorne dados realistas baseados no que é publicamente conhecido sobre este perfil.

IMPORTANTE: Todos os posts devem ter datas RECENTES, dos últimos 30-60 dias (entre fevereiro e abril de 2026). NÃO use datas de anos anteriores.

Para cada post, gere um thumbnail_url usando picsum.photos com IDs aleatórios diferentes. Use o formato: https://picsum.photos/seed/{seed}/600/600 onde {seed} é uma string única por post (ex: "post1", "insta_abc123").

Retorne um array JSON de posts com esta estrutura:
[{
  "platform_post_id": "string",
  "post_url": "string",
  "post_type": "image|video|reel|story",
  "caption": "string",
  "thumbnail_url": "string (URL picsum.photos)",
  "likes": number,
  "comments_count": number,
  "shares": number,
  "posted_at": "ISO date string (2026)"
}]

Retorne entre 10 e 20 posts. Seja realista com os números.`,
            },
            {
              role: "user",
              content: `Influenciador: @${influencer.username}\nPlataforma: ${influencer.platform}\nSeguidores: ${influencer.followers_count}\nEngajamento: ${influencer.engagement_rate}%\nMédia likes: ${influencer.avg_likes}\nMédia comentários: ${influencer.avg_comments}\nNotas: ${influencer.notes || "nenhuma"}`,
            },
          ],
          tools: [{
            type: "function",
            function: {
              name: "return_posts",
              description: "Return the estimated posts",
              parameters: {
                type: "object",
                properties: {
                  posts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        platform_post_id: { type: "string" },
                        post_url: { type: "string" },
                        post_type: { type: "string" },
                        caption: { type: "string" },
                        thumbnail_url: { type: "string" },
                        likes: { type: "number" },
                        comments_count: { type: "number" },
                        shares: { type: "number" },
                        posted_at: { type: "string" },
                      },
                      required: ["platform_post_id", "post_type", "caption", "likes", "comments_count", "posted_at"],
                    },
                  },
                },
                required: ["posts"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "return_posts" } },
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall) {
          const parsed = JSON.parse(toolCall.function.arguments);
          posts = parsed.posts || [];
        }
      }
    }

    // Clean old posts and comments before saving new ones
    const { data: oldPosts } = await supabase
      .from("influencer_posts")
      .select("id")
      .eq("influencer_id", influencer_id);

    if (oldPosts && oldPosts.length > 0) {
      const oldPostIds = oldPosts.map((p: any) => p.id);
      await supabase.from("influencer_comments").delete().in("post_id", oldPostIds);
      await supabase.from("influencer_posts").delete().eq("influencer_id", influencer_id);
    }

    // Save posts to database
    let savedCount = 0;
    for (const post of posts) {
      const { error: insertError } = await supabase.from("influencer_posts").insert({
        influencer_id,
        user_id: user.id,
        platform_post_id: post.platform_post_id,
        post_url: post.post_url,
        post_type: post.post_type,
        caption: post.caption,
        thumbnail_url: post.thumbnail_url,
        likes: post.likes || 0,
        comments_count: post.comments_count || 0,
        shares: post.shares || 0,
        posted_at: post.posted_at,
      });
      if (!insertError) savedCount++;
    }

    // Fetch real comments from Phyllo if available
    let commentsSource = "ai";
    if (source === "phyllo" && clientId && clientSecret) {
      const authToken = btoa(`${clientId}:${clientSecret}`);
      const phylloAuth = { Authorization: `Basic ${authToken}` };

      // Get saved post IDs in order
      const { data: savedPosts } = await supabase
        .from("influencer_posts")
        .select("id, platform_post_id")
        .eq("influencer_id", influencer_id)
        .order("created_at", { ascending: false })
        .limit(posts.length);

      const savedPostMap = new Map((savedPosts || []).map((p: any) => [p.platform_post_id, p.id]));
      let totalCommentsSaved = 0;

      for (const post of posts.slice(0, 10)) {
        const contentId = post._phyllo_content_id || post.platform_post_id;
        if (!contentId) continue;

        try {
          const commentsRes = await fetch(
            `${PHYLLO_BASE}/social/content/${contentId}/comments?limit=20`,
            { headers: phylloAuth }
          );

          if (commentsRes.ok) {
            const commentsData = await commentsRes.json();
            const comments = commentsData.data || [];
            const postId = savedPostMap.get(post.platform_post_id);
            if (!postId || comments.length === 0) continue;

            commentsSource = "phyllo";
            for (const c of comments) {
              await supabase.from("influencer_comments").insert({
                post_id: postId,
                author_username: c.author?.username || c.user?.username || "unknown",
                comment_text: c.text || c.content || "",
                sentiment: "neutral", // will be analyzed by analyze-influencer
                sentiment_score: 0.5,
                is_spam: false,
              });
              totalCommentsSaved++;
            }
          }
        } catch (e) {
          console.error(`Failed to fetch comments for content ${contentId}:`, e);
        }
      }

      if (totalCommentsSaved > 0) {
        console.log(`Saved ${totalCommentsSaved} real comments from Phyllo`);
      }
    }

    // Fallback: generate comments with AI if no real ones
    if (commentsSource === "ai" && posts.length > 0) {
      const commentResponse = await fetch(AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            {
              role: "system",
              content: `Gere comentários realistas para posts de um influenciador. Inclua uma mistura de positivos, negativos, neutros e spam. Retorne array JSON:
[{
  "post_index": number,
  "author_username": "string",
  "comment_text": "string",
  "sentiment": "positive|negative|neutral",
  "sentiment_score": number (0-1),
  "is_spam": boolean
}]
Gere 3-5 comentários por post, total máximo de 50 comentários.`,
            },
            {
              role: "user",
              content: `Influenciador: @${influencer.username} (${influencer.platform})\nPosts:\n${posts.slice(0, 10).map((p: any, i: number) => `${i}: "${(p.caption || "").substring(0, 100)}"`).join("\n")}`,
            },
          ],
          tools: [{
            type: "function",
            function: {
              name: "return_comments",
              description: "Return the generated comments",
              parameters: {
                type: "object",
                properties: {
                  comments: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        post_index: { type: "number" },
                        author_username: { type: "string" },
                        comment_text: { type: "string" },
                        sentiment: { type: "string" },
                        sentiment_score: { type: "number" },
                        is_spam: { type: "boolean" },
                      },
                      required: ["post_index", "author_username", "comment_text", "sentiment"],
                    },
                  },
                },
                required: ["comments"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "return_comments" } },
        }),
      });

      if (commentResponse.ok) {
        const commentData = await commentResponse.json();
        const toolCall = commentData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall) {
          const parsed = JSON.parse(toolCall.function.arguments);
          const genComments = parsed.comments || [];

          const { data: savedPosts } = await supabase
            .from("influencer_posts")
            .select("id")
            .eq("influencer_id", influencer_id)
            .order("created_at", { ascending: false })
            .limit(posts.length);

          const savedPostIds = (savedPosts || []).map((p: any) => p.id);

          for (const comment of genComments) {
            const postId = savedPostIds[comment.post_index];
            if (!postId) continue;
            await supabase.from("influencer_comments").insert({
              post_id: postId,
              author_username: comment.author_username,
              comment_text: comment.comment_text,
              sentiment: comment.sentiment || "neutral",
              sentiment_score: comment.sentiment_score || 0.5,
              is_spam: comment.is_spam || false,
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({
      data: {
        posts_saved: savedCount,
        source,
        comments_source: commentsSource,
        total_fetched: posts.length,
      },
    }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error("fetch-influencer-content error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }), {
      status: 500, headers: jsonHeaders,
    });
  }
});
