// Edge function: gera narração TTS via ElevenLabs a partir do texto de uma cena
// Recebe { texto, voice_id?, model_id?, voice_settings? } e devolve { audio_base64, mime_type }
import { encode as base64Encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface VoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
  speed?: number;
}

interface Body {
  texto?: string;
  voice_id?: string;
  model_id?: string;
  voice_settings?: VoiceSettings;
  previous_text?: string;
  next_text?: string;
}

const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // George — boa para narração PT/EN
const DEFAULT_MODEL = "eleven_multilingual_v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ELEVENLABS_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as Body;
    const texto = (body.texto ?? "").trim();
    if (!texto) {
      return new Response(
        JSON.stringify({ error: "Campo 'texto' é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (texto.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Texto excede 5000 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const voiceId = body.voice_id || DEFAULT_VOICE_ID;
    const modelId = body.model_id || DEFAULT_MODEL;
    const voiceSettings = {
      stability: 0.55,
      similarity_boost: 0.75,
      style: 0.35,
      use_speaker_boost: true,
      speed: 1.0,
      ...(body.voice_settings || {}),
    };

    const ttsResp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: texto,
          model_id: modelId,
          voice_settings: voiceSettings,
          ...(body.previous_text ? { previous_text: body.previous_text } : {}),
          ...(body.next_text ? { next_text: body.next_text } : {}),
        }),
      },
    );

    if (!ttsResp.ok) {
      const errText = await ttsResp.text();
      console.error("[elevenlabs-narracao] erro TTS:", ttsResp.status, errText);
      return new Response(
        JSON.stringify({
          error: `ElevenLabs falhou (${ttsResp.status})`,
          detail: errText.slice(0, 500),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const buffer = new Uint8Array(await ttsResp.arrayBuffer());
    const audio_base64 = base64Encode(buffer);

    return new Response(
      JSON.stringify({
        audio_base64,
        mime_type: "audio/mpeg",
        voice_id: voiceId,
        model_id: modelId,
        bytes: buffer.byteLength,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    console.error("[elevenlabs-narracao] exception:", e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
