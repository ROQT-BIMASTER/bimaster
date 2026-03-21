import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, imageBase64 } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Prompt é obrigatório (mínimo 3 caracteres)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const isEdit = !!imageBase64;

    const systemPrompt = isEdit
      ? `You are a professional banner designer. Edit the provided image according to the user's instructions. 
Output a horizontal web banner (aspect ratio approximately 3:1, like 1200x400px).
RULES:
- Follow the user's creative direction precisely.
- Maintain professional quality with sharp details and vibrant colors.
- Do not add watermarks or borders.
- The result must be a polished professional web banner.`
      : `You are a professional banner designer. Create a horizontal web banner image (aspect ratio approximately 3:1, like 1200x400px) based on the user's description.
RULES:
- Follow the user's creative direction precisely.
- Use vibrant, professional colors and clean composition.
- Do not add watermarks or borders.
- The result must be a polished professional web banner.`;

    const userContent: any[] = [
      { type: "text", text: prompt },
    ];

    if (isEdit) {
      userContent.push({
        type: "image_url",
        image_url: { url: imageBase64 },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione fundos em Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const outputImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!outputImage) {
      throw new Error("Nenhuma imagem foi gerada pela IA");
    }

    return new Response(JSON.stringify({ generatedImage: outputImage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-banner-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
