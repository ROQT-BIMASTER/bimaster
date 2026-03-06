import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { meetingId, query } = await req.json();
    if (!meetingId || !query) {
      return new Response(JSON.stringify({ error: "meetingId e query são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get meeting data
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings").select("transcription, highlights, title, summary").eq("id", meetingId).single();
    if (meetingError || !meeting) throw new Error("Reunião não encontrada");
    if (!meeting.transcription) throw new Error("Nenhuma transcrição disponível para busca");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um assistente de busca em transcrições de reuniões. O usuário vai perguntar sobre trechos específicos da reunião. Você deve:

1. Encontrar os trechos MAIS RELEVANTES da transcrição que respondem à pergunta
2. Para cada trecho encontrado, extraia o timestamp [MM:SS] se presente na transcrição
3. Se não houver timestamps explícitos, estime a posição temporal baseado na proporção do texto (início=0%, meio=50%, fim=100%)
4. Retorne uma resposta clara e os trechos encontrados

A reunião se chama: "${meeting.title}"
Resumo: ${meeting.summary || "N/A"}`,
          },
          {
            role: "user",
            content: `Transcrição completa da reunião:\n\n${meeting.transcription}\n\n---\n\nPergunta do usuário: ${query}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "search_results",
              description: "Retorna resultados da busca na transcrição da reunião",
              parameters: {
                type: "object",
                properties: {
                  answer: {
                    type: "string",
                    description: "Resposta resumida à pergunta do usuário, em 1-3 frases",
                  },
                  segments: {
                    type: "array",
                    description: "Trechos relevantes encontrados na transcrição",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "Trecho exato ou resumido da transcrição" },
                        speaker: { type: "string", description: "Quem falou, se identificável" },
                        timestamp: { type: "string", description: "Timestamp no formato MM:SS" },
                        timestamp_seconds: { type: "number", description: "Timestamp em segundos" },
                        relevance: { type: "string", enum: ["alta", "media", "baixa"], description: "Relevância para a pergunta" },
                        category: { type: "string", enum: ["decisao", "problema", "tarefa", "oportunidade", "informacao", "conflito"], description: "Categoria do trecho" },
                      },
                      required: ["text", "timestamp_seconds", "relevance", "category"],
                    },
                  },
                },
                required: ["answer", "segments"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "search_results" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Erro na busca com IA");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let result: any;

    if (toolCall?.function?.arguments) {
      let argsStr = toolCall.function.arguments;
      if (typeof argsStr === "string") {
        argsStr = argsStr.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        result = JSON.parse(argsStr);
      } else {
        result = argsStr;
      }
    } else {
      throw new Error("IA não retornou resultados estruturados");
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[meeting-search] error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro na busca" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
