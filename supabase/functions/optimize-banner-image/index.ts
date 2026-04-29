import { secureHandler } from "../_shared/secure-handler.ts";
import { z, validateBody } from "../_shared/validate.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { validateExternalUrl } from "../_shared/ssrf-guard.ts";

const OptimizeSchema = z
  .object({
    imageBase64: z.string().min(1).max(15_000_000).optional(),
    imageUrl: z.string().url().max(2000).optional(),
  })
  .strict()
  .refine((d) => !!(d.imageBase64 || d.imageUrl), {
    message: "imageBase64 or imageUrl is required",
  });

const PROMPT = `Adapt this image for use as a horizontal web banner (aspect ratio approximately 3:1, like 1200x400px).
IMPORTANT RULES:
- DO NOT crop or cut any part of the original image. The entire content must be fully visible.
- If needed, add a clean, professional background (white, light gray gradient, or subtle brand-appropriate color) to fill the extra horizontal space.
- Center the main content in the frame.
- Maintain sharp details, vibrant colors, and professional quality.
- Do not add any text, watermarks, logos, or borders.
- The result must look like a polished professional web banner.`;

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 30, rateLimitPrefix: "optimize-banner-image" },
    async (req) => {
      const cors = getCorsHeaders(req);
      const headers = { ...cors, "Content-Type": "application/json" };

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(
          JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
          { status: 503, headers }
        );
      }

      const body = await req.json().catch(() => ({}));
      const { imageBase64, imageUrl } = validateBody(body, OptimizeSchema);

      if (imageUrl) validateExternalUrl(imageUrl);

      const imgSource = imageBase64 || imageUrl!;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-image-preview",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: PROMPT },
                { type: "image_url", image_url: { url: imgSource } },
              ],
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Tente novamente em instantes." }),
            { status: 429, headers }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Créditos esgotados. Adicione fundos em Settings." }),
            { status: 402, headers }
          );
        }
        return new Response(JSON.stringify({ error: `AI gateway error: ${response.status}` }), {
          status: 502,
          headers,
        });
      }

      const data = await response.json();
      const outputImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (!outputImage) {
        return new Response(JSON.stringify({ error: "No image returned from AI" }), {
          status: 502,
          headers,
        });
      }

      return new Response(JSON.stringify({ optimizedImage: outputImage }), { headers });
    }
  )
);
