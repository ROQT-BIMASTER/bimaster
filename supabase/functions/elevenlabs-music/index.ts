import { secureHandler } from "../_shared/secure-handler.ts";
import { z, validateBody } from "../_shared/validate.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const MusicSchema = z
  .object({
    prompt: z.string().min(1).max(2000),
    duration: z.number().int().min(5).max(300).optional(),
  })
  .strict();

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 30, rateLimitPrefix: "elevenlabs-music" },
    async (req) => {
      const cors = getCorsHeaders(req);
      const jsonHeaders = { ...cors, "Content-Type": "application/json" };

      const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
      if (!ELEVENLABS_API_KEY) {
        return new Response(
          JSON.stringify({ error: "ElevenLabs API key not configured" }),
          { status: 503, headers: jsonHeaders }
        );
      }

      const body = await req.json().catch(() => ({}));
      const { prompt, duration } = validateBody(body, MusicSchema);

      const response = await fetch("https://api.elevenlabs.io/v1/music", {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          duration_seconds: duration || 30,
        }),
      });

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: `ElevenLabs API error: ${response.status}` }),
          { status: 502, headers: jsonHeaders }
        );
      }

      const audioBuffer = await response.arrayBuffer();

      return new Response(audioBuffer, {
        headers: { ...cors, "Content-Type": "audio/mpeg" },
      });
    }
  )
);
