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

    const elevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!elevenLabsKey) throw new Error("ELEVENLABS_API_KEY não configurada");

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
    const { meetingId, audioUrl, audioBase64, mimeType, chunkIndex, totalChunks } = body;

    if (!meetingId) {
      return new Response(JSON.stringify({ error: "meetingId é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── Step 1: Get audio bytes ──────────────────────────────────────────
    let audioBytes: Uint8Array;
    let audioMime: string;

    if (audioUrl) {
      console.log(`[meeting-transcribe] Fetching audio from URL, meetingId: ${meetingId}`);
      await supabaseAdmin.from("meetings").update({
        status: "transcribing",
        progress: 5,
        progress_detail: "Baixando áudio do servidor...",
      }).eq("id", meetingId);

      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) throw new Error(`Erro ao baixar áudio: ${audioResponse.status}`);

      audioBytes = new Uint8Array(await audioResponse.arrayBuffer());
      audioMime = audioResponse.headers.get("content-type") || mimeType || "audio/webm";
    } else if (audioBase64) {
      // Legacy path: base64 from client
      const binaryString = atob(audioBase64);
      audioBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        audioBytes[i] = binaryString.charCodeAt(i);
      }
      audioMime = mimeType || "audio/webm";
    } else {
      return new Response(JSON.stringify({ error: "audioUrl ou audioBase64 é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioMB = (audioBytes.length / 1024 / 1024).toFixed(1);
    console.log(`[meeting-transcribe] Audio: ${audioMB}MB, mime: ${audioMime}`);

    // ── Step 2: Transcribe with ElevenLabs Scribe v2 ─────────────────────
    await supabaseAdmin.from("meetings").update({
      status: "transcribing",
      progress: 15,
      progress_detail: "Transcrevendo com IA dedicada (Scribe v2)...",
    }).eq("id", meetingId);

    // Determine file extension from mime
    const extMap: Record<string, string> = {
      "audio/webm": "webm",
      "audio/ogg": "ogg",
      "audio/mp4": "mp4",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "video/webm": "webm",
      "video/mp4": "mp4",
    };
    const ext = extMap[audioMime] || "webm";

    const formData = new FormData();
    formData.append("file", new Blob([audioBytes], { type: audioMime }), `audio.${ext}`);
    formData.append("model_id", "scribe_v2");
    formData.append("language_code", "por");
    formData.append("diarize", "true");
    formData.append("tag_audio_events", "true");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000); // 5 min timeout

    let scribeResponse: Response;
    try {
      scribeResponse = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "xi-api-key": elevenLabsKey,
        },
        body: formData,
      });
    } catch (abortErr) {
      clearTimeout(timeout);
      console.error("[meeting-transcribe] Scribe timeout:", abortErr);
      return new Response(JSON.stringify({ error: "Timeout na transcrição. Tente novamente." }), {
        status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    clearTimeout(timeout);

    if (!scribeResponse.ok) {
      const errText = await scribeResponse.text();
      console.error("[meeting-transcribe] Scribe error:", scribeResponse.status, errText);

      if (scribeResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Erro na transcrição Scribe: ${scribeResponse.status} - ${errText}`);
    }

    const scribeData = await scribeResponse.json();
    console.log(`[meeting-transcribe] Scribe response: ${scribeData.text?.length || 0} chars, ${scribeData.words?.length || 0} words`);

    await supabaseAdmin.from("meetings").update({
      progress: 80,
      progress_detail: "Formatando transcrição...",
    }).eq("id", meetingId);

    // ── Step 3: Format transcription with speakers and timestamps ────────
    const transcription = formatTranscription(scribeData);

    if (!transcription || transcription.length < 5) {
      return new Response(JSON.stringify({ error: "Não foi possível transcrever o áudio." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[meeting-transcribe] Final transcription: ${transcription.length} chars`);

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

/**
 * Formats Scribe v2 response into a readable transcription with speakers and timestamps.
 */
function formatTranscription(scribeData: any): string {
  // If we have words with speaker info, group by speaker turns
  if (scribeData.words && scribeData.words.length > 0 && scribeData.words[0].speaker !== undefined) {
    return formatWithSpeakers(scribeData.words);
  }

  // Fallback: just return raw text with audio events
  let text = scribeData.text || "";

  if (scribeData.audio_events && scribeData.audio_events.length > 0) {
    for (const event of scribeData.audio_events) {
      const mm = String(Math.floor(event.start / 60)).padStart(2, "0");
      const ss = String(Math.floor(event.start % 60)).padStart(2, "0");
      text += `\n[${mm}:${ss}] [${event.type}]`;
    }
  }

  return text;
}

function formatWithSpeakers(words: any[]): string {
  if (!words || words.length === 0) return "";

  const lines: string[] = [];
  let currentSpeaker = words[0].speaker;
  let currentStart = words[0].start;
  let currentWords: string[] = [];

  for (const word of words) {
    if (word.speaker !== currentSpeaker) {
      // Flush current segment
      const mm = String(Math.floor(currentStart / 60)).padStart(2, "0");
      const ss = String(Math.floor(currentStart % 60)).padStart(2, "0");
      const speakerLabel = currentSpeaker !== undefined && currentSpeaker !== null
        ? `Falante ${Number(currentSpeaker) + 1}`
        : "Falante";
      lines.push(`[${mm}:${ss}] ${speakerLabel}: ${currentWords.join(" ")}`);

      currentSpeaker = word.speaker;
      currentStart = word.start;
      currentWords = [];
    }
    // Clean up word text (remove leading/trailing spaces)
    const w = (word.text || "").trim();
    if (w) currentWords.push(w);
  }

  // Flush last segment
  if (currentWords.length > 0) {
    const mm = String(Math.floor(currentStart / 60)).padStart(2, "0");
    const ss = String(Math.floor(currentStart % 60)).padStart(2, "0");
    const speakerLabel = currentSpeaker !== undefined && currentSpeaker !== null
      ? `Falante ${Number(currentSpeaker) + 1}`
      : "Falante";
    lines.push(`[${mm}:${ss}] ${speakerLabel}: ${currentWords.join(" ")}`);
  }

  return lines.join("\n\n");
}
