import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId } = await req.json();

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: 'conversationId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar mensagens da conversa
    const { data: messages, error: messagesError } = await supabase
      .from('whatsapp_messages')
      .select('message_text, sender, timestamp')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: true });

    if (messagesError) {
      console.error('Erro ao buscar mensagens:', messagesError);
      throw messagesError;
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma mensagem encontrada para esta conversa' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preparar contexto da conversa para análise
    const conversationText = messages
      .map(m => `${m.sender}: ${m.message_text}`)
      .join('\n');

    // Chamar Lovable AI para análise de sentimento
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
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
                  sentiment: {
                    type: "string",
                    enum: ["positive", "neutral", "negative"],
                    description: "Classificação do sentimento"
                  },
                  score: {
                    type: "number",
                    description: "Score numérico de -1 (muito negativo) a 1 (muito positivo)"
                  },
                  reason: {
                    type: "string",
                    description: "Breve explicação da análise"
                  }
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
      const errorText = await aiResponse.text();
      console.error('Erro na API Lovable AI:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente mais tarde.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`Erro na API: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('Resposta da IA:', JSON.stringify(aiData));

    // Extrair análise do tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('Resposta da IA não contém análise de sentimento');
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    // Atualizar conversa com análise de sentimento
    const { error: updateError } = await supabase
      .from('whatsapp_conversations')
      .update({
        sentiment: analysis.sentiment,
        sentiment_score: analysis.score,
        sentiment_analyzed_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (updateError) {
      console.error('Erro ao atualizar sentimento:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        sentiment: analysis.sentiment,
        score: analysis.score,
        reason: analysis.reason,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro na análise de sentimento:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao analisar sentimento' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
