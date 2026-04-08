import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { validateJWT } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { z, validateBody } from "../_shared/validate.ts";
import { handleError } from "../_shared/error-handler.ts";

const Schema = z.object({
  influencerId: z.string().min(1).max(200),
});

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const corsHeaders = getCorsHeaders(req);

  try {
    const auth = await validateJWT(req);
    await checkRateLimit({ prefix: "analyze-comments", limit: 10, req, userId: auth.userId });

    const body = await req.json();
    const { influencerId } = validateBody(body, Schema);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get post IDs for this influencer
    const { data: posts, error: postsError } = await supabase
      .from("influencer_posts")
      .select("id")
      .eq("influencer_id", influencerId);

    if (postsError) throw postsError;
    if (!posts || posts.length === 0) {
      return new Response(
        JSON.stringify({ analyzed: 0, message: "Nenhum post encontrado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const postIds = posts.map((p: any) => p.id);

    // Get unanalyzed comments
    const { data: comments, error: commentsError } = await supabase
      .from("influencer_comments")
      .select("id, comment_text, author_username")
      .in("post_id", postIds)
      .is("sentiment", null)
      .limit(50);

    if (commentsError) throw commentsError;
    if (!comments || comments.length === 0) {
      return new Response(
        JSON.stringify({ analyzed: 0, message: "Todos os comentários já foram analisados" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Batch comments for AI analysis (up to 50 at a time)
    const commentTexts = comments.map((c: any, i: number) =>
      `[${i}] @${c.author_username}: ${c.comment_text}`
    ).join("\n");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um analisador de sentimento. Analise cada comentário e classifique como positive, neutral ou negative com um score de -1 a 1.`
          },
          {
            role: "user",
            content: `Analise o sentimento de cada comentário:\n\n${commentTexts}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_sentiments",
              description: "Classifica o sentimento de cada comentário",
              parameters: {
                type: "object",
                properties: {
                  results: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "number" },
                        sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
                        score: { type: "number", description: "Score de -1 (muito negativo) a 1 (muito positivo)" }
                      },
                      required: ["index", "sentiment", "score"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["results"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "classify_sentiments" } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Erro na API de IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Resposta da IA sem análise");

    const { results } = JSON.parse(toolCall.function.arguments);
    let updatedCount = 0;

    for (const result of results) {
      if (result.index >= 0 && result.index < comments.length) {
        const comment = comments[result.index];
        const { error: updateError } = await supabase
          .from("influencer_comments")
          .update({
            sentiment: result.sentiment,
            sentiment_score: result.score,
          })
          .eq("id", comment.id);

        if (!updateError) updatedCount++;
      }
    }

    return new Response(
      JSON.stringify({ analyzed: updatedCount, total: comments.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleError(error, getCorsHeaders(req));
  }
});
