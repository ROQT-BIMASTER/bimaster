// Edge function: gera narração TTS via ElevenLabs e (opcional) salva no Storage + tabela
// Recebe { texto, voice_id?, model_id?, voice_settings?, roteiro_id?, cena_index?, voice_nome?, save? }
// Devolve { audio_base64, mime_type, voice_id, saved?: { id, audio_url, storage_path } }
import { encode as base64Encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";


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
  voice_nome?: string;
  model_id?: string;
  voice_settings?: VoiceSettings;
  previous_text?: string;
  next_text?: string;
  language?: "pt" | "en" | "auto";
  // Persistência opcional
  save?: boolean;
  roteiro_id?: string;
  cena_index?: number;
  texto_hash?: string;
}

const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const DEFAULT_MODEL = "eleven_multilingual_v2";
const BUCKET = "narracoes-roteirista";

// Detecta idioma de um texto curto (PT vs EN) por heurística rápida.
function detectarIdioma(texto: string): "pt" | "en" {
  const t = ` ${texto.toLowerCase()} `;
  const ptHits = (t.match(/[ãõáéíóúâêôç]| que | não | uma | para | com | dos | das | você | está | são | então | porque /g) || []).length;
  const enHits = (t.match(/ the | and | you | with | this | that | for | from | have | what | when | where | because /g) || []).length;
  if (ptHits === 0 && enHits === 0) return "pt";
  return enHits > ptHits ? "en" : "pt";
}

// Ajustes finos de voice_settings por idioma para maximizar fluidez.
function settingsParaIdioma(lang: "pt" | "en"): VoiceSettings {
  if (lang === "en") {
    return {
      stability: 0.5,
      similarity_boost: 0.78,
      style: 0.3,
      use_speaker_boost: true,
      speed: 1.0,
    };
  }
  // PT-BR — leve aumento de estabilidade e boost de similaridade ajudam prosódia.
  return {
    stability: 0.6,
    similarity_boost: 0.8,
    style: 0.4,
    use_speaker_boost: true,
    speed: 0.98,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ELEVENLABS_API_KEY não configurada" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as Body;
    const texto = (body.texto ?? "").trim();
    if (!texto) {
      return new Response(
        JSON.stringify({ error: "Campo 'texto' é obrigatório" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }
    if (texto.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Texto excede 5000 caracteres" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const voiceId = body.voice_id || DEFAULT_VOICE_ID;
    const modelId = body.model_id || DEFAULT_MODEL;

    // Idioma: explícito ou auto-detectado a partir do texto
    const lang: "pt" | "en" =
      body.language && body.language !== "auto"
        ? body.language
        : detectarIdioma(texto);

    const voiceSettings = {
      ...settingsParaIdioma(lang),
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
          language_code: lang === "en" ? "en" : "pt",
          voice_settings: voiceSettings,
          ...(body.previous_text ? { previous_text: body.previous_text } : {}),
          ...(body.next_text ? { next_text: body.next_text } : {}),
        }),
      },
    );

    if (!ttsResp.ok) {
      const errText = await ttsResp.text();
      logger.error("[elevenlabs-narracao] erro TTS:", ttsResp.status, errText);
      return new Response(
        JSON.stringify({
          error: `ElevenLabs falhou (${ttsResp.status})`,
          detail: errText.slice(0, 500),
        }),
        { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const buffer = new Uint8Array(await ttsResp.arrayBuffer());
    const audio_base64 = base64Encode(buffer);

    let saved: { id: string; audio_url: string; storage_path: string } | null = null;

    // Persistência opcional no Storage + tabela
    if (body.save && body.roteiro_id && typeof body.cena_index === "number") {
      try {
        const authHeader = req.headers.get("Authorization") || "";
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

        // Identifica o usuário pelo JWT
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: userData, error: userErr } = await userClient.auth.getUser();
        if (userErr || !userData.user) {
          logger.warn("[elevenlabs-narracao] save sem usuário válido:", userErr?.message);
        } else {
          const userId = userData.user.id;
          const admin = createClient(supabaseUrl, serviceRoleKey);

          const path = `${userId}/${body.roteiro_id}/cena-${body.cena_index}-${Date.now()}.mp3`;
          const { error: upErr } = await admin.storage
            .from(BUCKET)
            .upload(path, buffer, {
              contentType: "audio/mpeg",
              upsert: true,
            });

          if (upErr) {
            logger.error("[elevenlabs-narracao] upload storage:", upErr.message);
          } else {
            // URL assinada por 7 dias
            const { data: signed } = await admin.storage
              .from(BUCKET)
              .createSignedUrl(path, 60 * 60 * 24 * 7);

            const audioUrl = signed?.signedUrl || "";

            // Upsert na tabela
            const { data: row, error: insErr } = await admin
              .from("roteirista_narracoes")
              .upsert(
                {
                  user_id: userId,
                  roteiro_id: body.roteiro_id,
                  cena_index: body.cena_index,
                  voice_id: voiceId,
                  voice_nome: body.voice_nome || null,
                  texto,
                  texto_hash: body.texto_hash || `${voiceId}|${texto.length}`,
                  audio_url: audioUrl,
                  storage_path: path,
                  mime_type: "audio/mpeg",
                  tamanho_bytes: buffer.byteLength,
                },
                { onConflict: "roteiro_id,cena_index,texto_hash" },
              )
              .select("id, audio_url, storage_path")
              .single();

            if (insErr) {
              logger.error("[elevenlabs-narracao] insert tabela:", insErr.message);
            } else if (row) {
              saved = {
                id: row.id,
                audio_url: row.audio_url,
                storage_path: row.storage_path,
              };
            }
          }
        }
      } catch (persistErr) {
        logger.error("[elevenlabs-narracao] persistência falhou:", persistErr);
        // Não falha a request — áudio ainda é retornado em base64
      }
    }

    return new Response(
      JSON.stringify({
        audio_base64,
        mime_type: "audio/mpeg",
        voice_id: voiceId,
        model_id: modelId,
        language: lang,
        bytes: buffer.byteLength,
        saved,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    logger.error("[elevenlabs-narracao] exception:", e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
