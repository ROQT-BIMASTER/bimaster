import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { validateJWT } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { z, validateBody } from "../_shared/validate.ts";
import { handleError } from "../_shared/error-handler.ts";

const SentimentSchema = z.object({
  conversationId: z.string().min(1).max(200),
});

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const corsHeaders = getCorsHeaders(req);

  try {
    const auth = await validateJWT(req);
    await checkRateLimit({ prefix: "analyze-sentiment", limit: 20, req, userId: auth.userId });

    const body = await req.json();
    const { conversationId } = validateBody(body, SentimentSchema);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: messages, error: messagesError } = await supabase
      .from('whatsapp_messages')
      .select('message_text, sender, timestamp')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: true });

    if (messagesError) throw messagesError;

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma mensagem encontrada para esta conversa' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const conversationText = messages
      .map(m => `${m.sender}: ${m.message_text}`)
      .join('\n');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content: `Você é um analisador de sentimento especializado em conversas de WhatsApp. 
Analise o sentimento geral da conversa e retorne APENAS um JSON com este formato exato:
{"sentiment": "positive" | "neutral" | "negative", "score": número entre -1 e 1, "reason": "breve explicação"}

Critérios:
- positive (score > 0.3): Cliente satisfeito, responde positivamente, demonstra interesse
- neutral (score -0.3 a 0.3): Cliente neutro, sem emoção clara, apenas informativo
- negative (score < -0.3): Cliente insatisfeito, frustrado, com reclamações

Considere o contexto geral e a evolução da conversa.`
          },
          {
            role: 'user',
            content: `Analise o sentimento desta conversa:\n\n${conversationText}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_sentiment",
              description: "Retorna a análise de sentimento da conversa",
              parameters: {
                type: "object",
                properties: {
                  sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
                  score: { type: "number" },
                  reason: { type: "string" }
                },
                required: ["sentiment", "score", "reason"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "analyze_sentiment" } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Erro na API: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('Resposta da IA não contém análise');

    const analysis = JSON.parse(toolCall.function.arguments);

    const { error: updateError } = await supabase
      .from('whatsapp_conversations')
      .update({
        sentiment: analysis.sentiment,
        sentiment_score: analysis.score,
        sentiment_analyzed_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        sentiment: analysis.sentiment,
        score: analysis.score,
        reason: analysis.reason,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return handleError(error, getCorsHeaders(req));
  }
});
