import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  try {
    const { imageBase64, imageUrl } = await req.json();

    const imgSource = imageBase64 || imageUrl;
    if (!imgSource) {
      return new Response(JSON.stringify({ error: "imageBase64 or imageUrl is required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `Adapt this image for use as a horizontal web banner (aspect ratio approximately 3:1, like 1200x400px). 
IMPORTANT RULES:
- DO NOT crop or cut any part of the original image. The entire content must be fully visible.
- If needed, add a clean, professional background (white, light gray gradient, or subtle brand-appropriate color) to fill the extra horizontal space.
- Center the main content in the frame.
- Maintain sharp details, vibrant colors, and professional quality.
- Do not add any text, watermarks, logos, or borders.
- The result must look like a polished professional web banner.`;

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
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: imgSource },
              },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione fundos em Settings." }), {
          status: 402,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const outputImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!outputImage) {
      throw new Error("No image returned from AI");
    }

    return new Response(JSON.stringify({ optimizedImage: outputImage }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("optimize-banner-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
