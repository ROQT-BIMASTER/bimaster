import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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

    const body = await req.json();
    const { meetingId, audioUrl, audioBase64, mimeType, chunkIndex, totalChunks, startSeconds, endSeconds } = body;

    if (!meetingId) {
      return new Response(JSON.stringify({ error: "meetingId é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let finalBase64: string;
    let finalMimeType: string;

    if (audioUrl) {
      // NEW PATH: Download audio from Storage via signed URL (server-side)
      console.log(`[meeting-transcribe] Fetching audio from URL, meetingId: ${meetingId}`);
      
      await supabaseAdmin.from("meetings").update({
        status: "transcribing",
        progress: 10,
        progress_detail: "Baixando áudio do servidor...",
      }).eq("id", meetingId);

      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Erro ao baixar áudio: ${audioResponse.status}`);
      }

      const audioBuffer = await audioResponse.arrayBuffer();
      const audioBytes = new Uint8Array(audioBuffer);
      finalBase64 = base64Encode(audioBytes);
      finalMimeType = audioResponse.headers.get("content-type") || mimeType || "audio/webm";

      const audioMB = (audioBytes.length / 1024 / 1024).toFixed(1);
      const base64MB = (finalBase64.length / 1024 / 1024).toFixed(1);
      console.log(`[meeting-transcribe] Downloaded ${audioMB}MB, base64: ${base64MB}MB, mime: ${finalMimeType}`);

      await supabaseAdmin.from("meetings").update({
        progress: 20,
        progress_detail: "Transcrevendo áudio completo...",
      }).eq("id", meetingId);

    } else if (audioBase64) {
      // LEGACY PATH: Direct base64 from client (kept for backward compat)
      finalBase64 = audioBase64;
      finalMimeType = mimeType || "audio/webm";
      
      const idx = chunkIndex || 0;
      const chunks = totalChunks || 1;
      console.log(`[meeting-transcribe] Legacy path: chunk ${idx + 1}/${chunks}, base64 length: ${finalBase64.length}`);
      
      const progressPct = Math.round(5 + ((idx) / chunks) * 80);
      await supabaseAdmin.from("meetings").update({
        status: "transcribing",
        progress: progressPct,
        progress_detail: `Transcrevendo trecho ${idx + 1} de ${chunks}...`,
      }).eq("id", meetingId);
    } else {
      return new Response(JSON.stringify({ error: "audioUrl ou audioBase64 é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build temporal context for prompt
    const chunkStart = startSeconds || 0;
    const chunkEnd = endSeconds || 0;
    const startMin = Math.floor(chunkStart / 60);
    const startSec = Math.floor(chunkStart % 60);
    const endMin = Math.floor(chunkEnd / 60);
    const endSec = Math.floor(chunkEnd % 60);
    const timeRange = chunkEnd > 0
      ? `\n\nEste trecho corresponde ao período de ${String(startMin).padStart(2, "0")}:${String(startSec).padStart(2, "0")} até ${String(endMin).padStart(2, "0")}:${String(endSec).padStart(2, "0")} da gravação original. Use esses timestamps como referência.`
      : "";

    const systemPrompt = `Você é um transcritor profissional. Transcreva o áudio/vídeo COMPLETO em português do Brasil, do início ao fim, sem omitir nenhuma parte.

REGRAS OBRIGATÓRIAS:
1. Transcreva TODAS as falas, do primeiro ao último segundo do áudio
2. Identifique falantes quando possível (use nomes mencionados ou "Falante 1", "Falante 2")
3. Inclua timestamps aproximados a cada 2-3 minutos no formato [MM:SS]
4. NÃO pare no meio — continue até o final absoluto do áudio
5. Retorne APENAS a transcrição completa, sem resumos, comentários ou análises
6. Se houver silêncio ou ruído, indique brevemente: [silêncio] ou [ruído de fundo]${timeRange}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000); // 3 min timeout for full audio

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
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: "Transcreva este áudio/vídeo completo, do início ao fim." },
                { type: "image_url", image_url: { url: `data:${finalMimeType};base64,${finalBase64}` } },
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
      return new Response(JSON.stringify({ error: "Não foi possível transcrever o áudio." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ transcription, chunkIndex: chunkIndex || 0, success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[meeting-transcribe] error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro ao transcrever mídia" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
