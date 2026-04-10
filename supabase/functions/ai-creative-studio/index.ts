import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { validateJWT } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { z, validateBody } from "../_shared/validate.ts";
import { handleError } from "../_shared/error-handler.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const GenerateSchema = z.object({
  prompt: z.string().min(1).max(5000),
  imageBase64: z.string().max(10000000).optional(),
  model: z.enum(["flash", "pro"]).default("flash"),
  format: z.enum(["1:1", "9:16", "16:9", "4:5", "3:4"]).default("1:1"),
  category: z.enum(["marketing", "mockup", "social_media"]).default("marketing"),
  parentAssetId: z.string().uuid().optional(),
});

const MODEL_MAP: Record<string, string> = {
  flash: "google/gemini-3.1-flash-image-preview",
  pro: "google/gemini-3-pro-image-preview",
};

const FORMAT_PROMPTS: Record<string, string> = {
  "1:1": "Square format (1:1 aspect ratio, like 1080x1080px for Instagram feed).",
  "9:16": "Vertical format (9:16 aspect ratio, like 1080x1920px for Stories/Reels).",
  "16:9": "Horizontal format (16:9 aspect ratio, like 1920x1080px for banners/covers).",
  "4:5": "Portrait format (4:5 aspect ratio, like 1080x1350px for Instagram portrait).",
  "3:4": "Portrait format (3:4 aspect ratio, like 1080x1440px for product shots).",
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const corsHeaders = getCorsHeaders(req);

  try {
    const auth = await validateJWT(req);
    await checkRateLimit({ prefix: "ai-creative-studio", limit: 15, req, userId: auth.userId });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const body = await req.json();
    const { prompt, imageBase64, model, format, category, parentAssetId } = validateBody(body, GenerateSchema);

    const modelId = MODEL_MAP[model];
    const formatHint = FORMAT_PROMPTS[format];

    const systemPrompt = `You are a world-class creative director and graphic designer. Generate stunning, professional images for marketing and branding purposes.
RULES:
- ${formatHint}
- Create vibrant, high-quality, commercially viable images.
- Follow the user's creative direction precisely.
- Do not add watermarks, borders, or text unless explicitly requested.
- The result must look like it was created by a professional design agency.`;

    const userContent: any[] = [{ type: "text", text: prompt }];

    if (imageBase64) {
      const imageUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/png;base64,${imageBase64}`;
      userContent.push({ type: "image_url", image_url: { url: imageUrl } });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione fundos em Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const textResponse = data.choices?.[0]?.message?.content;

    if (!generatedImage) {
      return new Response(JSON.stringify({ error: "Não foi possível gerar a imagem", textResponse }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save to storage
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let storagePath: string | null = null;
    let publicUrl: string | null = null;

    try {
      // Extract base64 data
      const base64Match = generatedImage.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
      if (base64Match) {
        const ext = base64Match[1] === "jpeg" ? "jpg" : base64Match[1];
        const rawBase64 = base64Match[2];
        const binaryStr = atob(rawBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

        const fileName = `${auth.userId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from("creative-studio")
          .upload(fileName, bytes, { contentType: `image/${base64Match[1]}`, upsert: false });

        if (!uploadError) {
          storagePath = fileName;
          const { data: urlData } = supabaseAdmin.storage.from("creative-studio").getPublicUrl(fileName);
          publicUrl = urlData.publicUrl;
        } else {
          console.error("Upload error:", uploadError);
        }
      }
    } catch (uploadErr) {
      console.error("Storage upload failed:", uploadErr);
    }

    // Save metadata
    const assetType = imageBase64 ? "imagem_editada" : "imagem_gerada";
    const { data: asset, error: insertError } = await supabaseAdmin
      .from("creative_studio_assets")
      .insert({
        user_id: auth.userId,
        prompt,
        image_url: publicUrl || generatedImage,
        storage_path: storagePath,
        model_used: modelId,
        asset_type: assetType,
        category,
        format,
        parent_asset_id: parentAssetId || null,
      })
      .select("id")
      .single();

    if (insertError) console.error("Insert error:", insertError);

    return new Response(JSON.stringify({
      imageUrl: publicUrl || generatedImage,
      assetId: asset?.id,
      model: modelId,
      message: textResponse,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleError(error, getCorsHeaders(req));
  }
});
