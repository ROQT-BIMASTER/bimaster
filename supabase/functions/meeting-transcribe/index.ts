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
    const chunks = totalChunks || 1;
    const idx = chunkIndex || 0;

    console.log(`[meeting-transcribe] Processing chunk ${idx + 1}/${chunks}, base64 length: ${audioBase64.length}, mime: ${resolvedMimeType}`);

    // Update progress in DB
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const progressPct = Math.round(5 + ((idx) / chunks) * 80);
    await supabaseAdmin.from("meetings").update({
      status: "transcribing",
      progress: progressPct,
      progress_detail: `Transcrevendo trecho ${idx + 1} de ${chunks}...`,
    }).eq("id", meetingId);

    // Simplified prompt — just transcribe, diarization moves to analysis step
    const systemPrompt = `Transcreva o áudio/vídeo completo em português do Brasil, palavra por palavra. Identifique falantes quando possível (use nomes mencionados ou "Falante 1", "Falante 2"). Retorne APENAS a transcrição, sem resumos ou comentários.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000);

    let transcribeResponse: Response;
    try {
      transcribeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: "Transcreva este áudio/vídeo." },
                { type: "image_url", image_url: { url: `data:${resolvedMimeType};base64,${audioBase64}` } },
              ],
            },
          ],
          temperature: 0.1,
        }),
      });
    } catch (abortErr) {
      clearTimeout(timeout);
      console.error("[meeting-transcribe] Request aborted/timeout:", abortErr);
      return new Response(JSON.stringify({ error: "Timeout na transcrição. Tente novamente." }), {
        status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    clearTimeout(timeout);

    if (!transcribeResponse.ok) {
      const errText = await transcribeResponse.text();
      console.error("[meeting-transcribe] AI error:", transcribeResponse.status, errText);

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
    console.log("[meeting-transcribe] Transcription length:", transcription?.length || 0);

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
