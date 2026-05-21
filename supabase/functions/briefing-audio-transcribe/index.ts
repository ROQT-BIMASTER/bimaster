import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 30, rateLimitPrefix: "briefing-audio-transcribe" },
    async (req) => {
      const cors = getCorsHeaders(req);
      const json = (status: number, body: unknown) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { ...cors, "Content-Type": "application/json" },
        });

      if (req.method !== "POST") return json(405, { error: "Método não suportado" });

      const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
      if (!apiKey) return json(500, { error: "Serviço de transcrição não configurado" });

      let form: FormData;
      try {
        form = await req.formData();
      } catch {
        return json(400, { error: "Envie o áudio como multipart/form-data (campo 'audio')" });
      }

      const audio = form.get("audio");
      if (!(audio instanceof File) && !(audio instanceof Blob)) {
        return json(400, { error: "Campo 'audio' é obrigatório" });
      }

      const blob = audio as Blob;
      if (blob.size === 0) return json(400, { error: "Áudio vazio" });
      if (blob.size > MAX_BYTES) return json(413, { error: "Áudio acima de 10 MB" });

      const mime = (blob.type || "").toLowerCase();
      if (mime && !mime.startsWith("audio/") && !mime.startsWith("video/webm")) {
        return json(400, { error: "Formato inválido. Envie um arquivo de áudio." });
      }

      const upstream = new FormData();
      upstream.append(
        "file",
        blob,
        (audio as File).name || `audio-${Date.now()}.webm`,
      );
      upstream.append("model_id", "scribe_v2");
      upstream.append("language_code", "por");
      upstream.append("tag_audio_events", "false");
      upstream.append("diarize", "false");

      let resp: Response;
      try {
        resp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
          method: "POST",
          headers: { "xi-api-key": apiKey },
          body: upstream,
        });
      } catch (err) {
        console.error("[briefing-audio-transcribe] network error", err);
        return json(502, { error: "Falha de rede ao transcrever o áudio" });
      }

      if (!resp.ok) {
        const detail = await resp.text().catch(() => "");
        console.error("[briefing-audio-transcribe] upstream", resp.status, detail.slice(0, 500));
        if (resp.status === 401) return json(500, { error: "Serviço de transcrição não autenticado" });
        if (resp.status === 402) return json(402, { error: "Crédito de transcrição esgotado. Contate o administrador." });
        if (resp.status === 429) return json(429, { error: "Muitas transcrições em sequência. Aguarde alguns segundos." });
        return json(502, { error: "Não foi possível transcrever o áudio. Tente novamente." });
      }

      let data: { text?: string } = {};
      try { data = await resp.json(); } catch { /* ignore */ }
      const text = (data?.text ?? "").trim();
      if (!text) return json(422, { error: "Não conseguimos identificar fala no áudio." });

      return json(200, { text });
    },
  ),
);
