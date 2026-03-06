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

    const { meetingId } = await req.json();
    if (!meetingId) {
      return new Response(JSON.stringify({ error: "meetingId é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings").select("id, audio_url, transcription").eq("id", meetingId).single();
    if (meetingError || !meeting) throw new Error("Reunião não encontrada");

    // If transcription already exists, return it
    if (meeting.transcription) {
      console.log("[meeting-transcribe] Transcription already exists, skipping");
      return new Response(JSON.stringify({ transcription: meeting.transcription, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioUrl = meeting.audio_url as string;
    if (!audioUrl) {
      return new Response(JSON.stringify({ error: "Nenhuma mídia disponível para transcrição." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin.from("meetings").update({ status: "transcribing" }).eq("id", meetingId);

    // Generate a signed URL if it's a storage path
    let mediaUrl = audioUrl;
    try {
      const urlObj = new URL(audioUrl);
      const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)/);
      if (pathMatch) {
        const bucket = pathMatch[1];
        const filePath = decodeURIComponent(pathMatch[2].split('?')[0]);
        console.log(`[meeting-transcribe] Generating signed URL for ${bucket}/${filePath}`);
        const { data: signedData, error: signError } = await supabaseAdmin.storage
          .from(bucket)
          .createSignedUrl(filePath, 3600); // 1 hour
        if (!signError && signedData?.signedUrl) {
          mediaUrl = signedData.signedUrl;
        }
      }
    } catch {
      // Not a parseable URL, use as-is
    }

    // Detect MIME type
    const isVideo = audioUrl.includes(".mp4") || audioUrl.includes(".mov") || audioUrl.includes(".avi") || audioUrl.includes(".mkv") || audioUrl.includes("video/");
    const mimeType = isVideo ? "video/mp4" : 
      audioUrl.includes(".mp3") ? "audio/mpeg" :
      audioUrl.includes(".wav") ? "audio/wav" :
      audioUrl.includes(".m4a") ? "audio/mp4" :
      "audio/webm";

    console.log(`[meeting-transcribe] Sending URL to Gemini, mimeType: ${mimeType}`);

    // Use Gemini's file_url capability — NO base64, NO memory issues
    const transcribeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `Você é um transcritor profissional de áudio/vídeo com capacidade de DIARIZAÇÃO (identificação de falantes).

REGRAS DE TRANSCRIÇÃO:
1. Transcreva tudo que foi falado, palavra por palavra, em português do Brasil
2. IDENTIFIQUE CADA FALANTE DISTINTO — quando o nome é mencionado na conversa, use o nome real (ex: "João:", "Maria:")
3. Se o nome não for mencionado, use "Falante 1:", "Falante 2:", etc.
4. Indique mudanças de falante em cada fala
5. Marque pausas significativas com [pausa]
6. Inclua timestamps aproximados a cada 1-2 minutos no formato [MM:SS]
7. NÃO adicione interpretações, resumos ou comentários

FORMATO:
[00:00] João: Bom dia a todos, vamos começar a reunião...
[00:15] Maria: Obrigada João, eu queria falar sobre...`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcreva completamente este áudio/vídeo de reunião com identificação de cada falante. Retorne APENAS a transcrição diarizada." },
              { type: "image_url", image_url: { url: mediaUrl } },
            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!transcribeResponse.ok) {
      const errText = await transcribeResponse.text();
      console.error("[meeting-transcribe] Gemini error:", transcribeResponse.status, errText);
      await supabaseAdmin.from("meetings").update({ status: "error" }).eq("id", meetingId);

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
    console.log("[meeting-transcribe] Transcription completed, length:", transcription?.length || 0);

    if (!transcription || transcription.length < 10) {
      await supabaseAdmin.from("meetings").update({ status: "error" }).eq("id", meetingId);
      return new Response(JSON.stringify({ error: "Não foi possível transcrever a mídia. Tente colar a transcrição manualmente." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin.from("meetings").update({
      transcription,
      status: "transcribed",
      updated_at: new Date().toISOString(),
    }).eq("id", meetingId);

    return new Response(JSON.stringify({ transcription, success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[meeting-transcribe] error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro ao transcrever mídia" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
