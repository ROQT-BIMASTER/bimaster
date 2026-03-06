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
    const { meetingId, audioUrl, storagePath } = body;

    if (!meetingId) {
      return new Response(JSON.stringify({ error: "meetingId é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!audioUrl && !storagePath) {
      return new Response(JSON.stringify({ error: "audioUrl ou storagePath é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── Step 1: Download audio ──────────────────────────────────────────
    await supabaseAdmin.from("meetings").update({
      status: "transcribing",
      progress: 5,
      progress_detail: "Baixando áudio do servidor...",
    }).eq("id", meetingId);

    let audioBytes: Uint8Array;
    let audioMime: string;
    let downloadUrl = audioUrl;

    // If we have a storage path, generate a fresh signed URL server-side (faster, no CORS)
    if (storagePath) {
      const { data: signedData, error: signedError } = await supabaseAdmin.storage
        .from("meeting-recordings")
        .createSignedUrl(storagePath, 600);
      if (signedError || !signedData?.signedUrl) {
        throw new Error("Erro ao gerar URL de acesso ao áudio");
      }
      downloadUrl = signedData.signedUrl;
    }

    console.log(`[meeting-transcribe] Downloading audio for meetingId: ${meetingId}`);
    const downloadStart = Date.now();

    const audioResponse = await fetch(downloadUrl);
    if (!audioResponse.ok) throw new Error(`Erro ao baixar áudio: ${audioResponse.status}`);

    audioBytes = new Uint8Array(await audioResponse.arrayBuffer());
    audioMime = audioResponse.headers.get("content-type") || "audio/webm";

    const downloadMs = Date.now() - downloadStart;
    const audioMB = (audioBytes.length / 1024 / 1024).toFixed(1);
    console.log(`[meeting-transcribe] Downloaded ${audioMB}MB in ${downloadMs}ms, mime: ${audioMime}`);

    // ── Step 2: Transcribe with ElevenLabs Scribe v2 ─────────────────────
    await supabaseAdmin.from("meetings").update({
      status: "transcribing",
      progress: 20,
      progress_detail: `Transcrevendo ${audioMB}MB com IA dedicada (Scribe v2)...`,
    }).eq("id", meetingId);

    const extMap: Record<string, string> = {
      "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "mp4",
      "audio/mpeg": "mp3", "audio/wav": "wav", "video/webm": "webm", "video/mp4": "mp4",
    };
    const ext = extMap[audioMime] || "webm";

    const formData = new FormData();
    formData.append("file", new Blob([audioBytes], { type: audioMime }), `audio.${ext}`);
    formData.append("model_id", "scribe_v2");
    formData.append("language_code", "por");
    formData.append("diarize", "true");
    formData.append("tag_audio_events", "true");

    // Free the audio bytes from memory before calling Scribe
    audioBytes = new Uint8Array(0);

    const scribeController = new AbortController();
    // Scribe v2 is fast: 1h audio ≈ 10-30s. Set 120s timeout as safety margin.
    const scribeTimeout = setTimeout(() => scribeController.abort(), 120000);

    console.log(`[meeting-transcribe] Calling ElevenLabs Scribe v2...`);
    const scribeStart = Date.now();

    let scribeResponse: Response;
    try {
      scribeResponse = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        signal: scribeController.signal,
        headers: { "xi-api-key": elevenLabsKey },
        body: formData,
      });
    } catch (abortErr) {
      clearTimeout(scribeTimeout);
      console.error("[meeting-transcribe] Scribe timeout after", Date.now() - scribeStart, "ms");
      await supabaseAdmin.from("meetings").update({
        status: "draft",
        progress: 0,
        progress_detail: "Timeout na transcrição. Tente novamente.",
      }).eq("id", meetingId);
      return new Response(JSON.stringify({ error: "Timeout na transcrição. Tente novamente." }), {
        status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    clearTimeout(scribeTimeout);

    const scribeMs = Date.now() - scribeStart;
    console.log(`[meeting-transcribe] Scribe responded in ${scribeMs}ms, status: ${scribeResponse.status}`);

    if (!scribeResponse.ok) {
      const errText = await scribeResponse.text();
      console.error("[meeting-transcribe] Scribe error:", scribeResponse.status, errText);

      if (scribeResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Erro na transcrição Scribe: ${scribeResponse.status}`);
    }

    const scribeData = await scribeResponse.json();
    console.log(`[meeting-transcribe] Scribe result: ${scribeData.text?.length || 0} chars, ${scribeData.words?.length || 0} words`);

    // ── Step 3: Format transcription ────────────────────────────────────
    await supabaseAdmin.from("meetings").update({
      progress: 80,
      progress_detail: "Formatando transcrição...",
    }).eq("id", meetingId);

    const transcription = formatTranscription(scribeData);

    if (!transcription || transcription.length < 5) {
      await supabaseAdmin.from("meetings").update({
        status: "draft", progress: 0,
        progress_detail: "Não foi possível transcrever o áudio.",
      }).eq("id", meetingId);
      return new Response(JSON.stringify({ error: "Não foi possível transcrever o áudio." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[meeting-transcribe] Final transcription: ${transcription.length} chars`);

    // Save transcription immediately to DB as safeguard
    await supabaseAdmin.from("meetings").update({
      transcription,
      status: "transcribed",
      progress: 85,
      progress_detail: "✓ Transcrição concluída",
      updated_at: new Date().toISOString(),
    }).eq("id", meetingId);

    return new Response(JSON.stringify({ transcription, success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[meeting-transcribe] error:", error);

    // Try to reset meeting status on error
    try {
      const body = await req.clone().json().catch(() => null);
      if (body?.meetingId) {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabaseAdmin.from("meetings").update({
          status: "draft", progress: 0,
          progress_detail: `Erro: ${error.message?.substring(0, 100)}`,
        }).eq("id", body.meetingId);
      }
    } catch { /* ignore cleanup errors */ }

    return new Response(JSON.stringify({ error: error.message || "Erro ao transcrever" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Formatting helpers ──────────────────────────────────────────────────

function formatTranscription(scribeData: any): string {
  // Prefer word-level data with speaker diarization
  if (scribeData.words?.length > 0 && scribeData.words[0].speaker !== undefined) {
    return formatWithSpeakers(scribeData.words, scribeData.audio_events);
  }
  // Fallback: raw text
  let text = scribeData.text || "";
  if (scribeData.audio_events?.length > 0) {
    for (const event of scribeData.audio_events) {
      text += `\n[${ts(event.start)}] [${event.type}]`;
    }
  }
  return text;
}

function formatWithSpeakers(words: any[], audioEvents?: any[]): string {
  if (!words?.length) return "";

  const lines: string[] = [];
  let currentSpeaker = words[0].speaker;
  let currentStart = words[0].start;
  let currentWords: string[] = [];

  for (const word of words) {
    if (word.speaker !== currentSpeaker) {
      flushSegment(lines, currentSpeaker, currentStart, currentWords);
      currentSpeaker = word.speaker;
      currentStart = word.start;
      currentWords = [];
    }
    const w = (word.text || "").trim();
    if (w) currentWords.push(w);
  }
  flushSegment(lines, currentSpeaker, currentStart, currentWords);

  // Append audio events at the end
  if (audioEvents?.length) {
    lines.push("");
    for (const event of audioEvents) {
      lines.push(`[${ts(event.start)}] [${event.type}]`);
    }
  }

  return lines.join("\n\n");
}

function flushSegment(lines: string[], speaker: any, start: number, words: string[]) {
  if (!words.length) return;
  const label = speaker !== undefined && speaker !== null
    ? `Falante ${Number(speaker) + 1}` : "Falante";
  lines.push(`[${ts(start)}] ${label}: ${words.join(" ")}`);
}

function ts(seconds: number): string {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${mm}:${ss}`;
}
