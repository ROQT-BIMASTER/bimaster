import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Accept chunk data directly from the client
    const { meetingId, audioBase64, mimeType, chunkIndex, totalChunks } = await req.json();

    if (!meetingId) {
      return new Response(JSON.stringify({ error: "meetingId é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!audioBase64) {
      return new Response(JSON.stringify({ error: "audioBase64 é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resolvedMimeType = mimeType || "audio/webm";
    const isFirstChunk = (chunkIndex || 0) === 0;
    const chunks = totalChunks || 1;
    const idx = chunkIndex || 0;

    console.log(`[meeting-transcribe] Processing chunk ${idx + 1}/${chunks}, base64 length: ${audioBase64.length}, mime: ${resolvedMimeType}`);

    // Update status on first chunk
    if (isFirstChunk) {
      const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabaseAdmin.from("meetings").update({ status: "transcribing" }).eq("id", meetingId);
    }

    // Build system prompt with chunk context
    let systemPrompt = `Você é um transcritor profissional de áudio/vídeo com capacidade de DIARIZAÇÃO (identificação de falantes).

REGRAS DE TRANSCRIÇÃO:
1. Transcreva tudo que foi falado, palavra por palavra, em português do Brasil
2. IDENTIFIQUE CADA FALANTE DISTINTO — quando o nome é mencionado na conversa, use o nome real (ex: "João:", "Maria:")
3. Se o nome não for mencionado, use "Falante 1:", "Falante 2:", etc.
4. Indique mudanças de falante em cada fala
5. Marque pausas significativas com [pausa]
6. NÃO adicione interpretações, resumos ou comentários
7. Retorne APENAS a transcrição

FORMATO:
João: Bom dia a todos, vamos começar a reunião...
Maria: Obrigada João, eu queria falar sobre...`;

    if (chunks > 1) {
      systemPrompt += `\n\nIMPORTANTE: Este é o trecho ${idx + 1} de ${chunks} de uma gravação longa. Transcreva apenas o conteúdo audível deste trecho. Não repita conteúdo de trechos anteriores.`;
    }

    const transcribeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: `Transcreva completamente este trecho de áudio/vídeo (parte ${idx + 1} de ${chunks}). Retorne APENAS a transcrição.` },
              { type: "image_url", image_url: { url: `data:${resolvedMimeType};base64,${audioBase64}` } },
            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!transcribeResponse.ok) {
      const errText = await transcribeResponse.text();
      console.error("[meeting-transcribe] Gemini error:", transcribeResponse.status, errText);

      if (transcribeResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (transcribeResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Erro na transcrição: ${transcribeResponse.status}`);
    }

    const transcribeData = await transcribeResponse.json();
    const transcription = transcribeData.choices?.[0]?.message?.content?.trim();
    console.log("[meeting-transcribe] Chunk transcription length:", transcription?.length || 0);

    if (!transcription || transcription.length < 5) {
      return new Response(JSON.stringify({ error: "Não foi possível transcrever este trecho de áudio." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ transcription, chunkIndex: idx, success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[meeting-transcribe] error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro ao transcrever mídia" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
