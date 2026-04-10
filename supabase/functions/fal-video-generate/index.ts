import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const FAL_MODELS: Record<string, { endpoint: string; name: string; supportsImage: boolean }> = {
  "google-veo-3": {
    endpoint: "https://queue.fal.run/fal-ai/veo3",
    name: "Google Veo 3",
    supportsImage: false,
  },
  "kling-2.0": {
    endpoint: "https://queue.fal.run/fal-ai/kling-video/v2/master",
    name: "Kling 2.0 Master",
    supportsImage: true,
  },
  "minimax-text": {
    endpoint: "https://queue.fal.run/fal-ai/minimax-video",
    name: "MiniMax (Hailuo)",
    supportsImage: false,
  },
  "minimax-image": {
    endpoint: "https://queue.fal.run/fal-ai/minimax-video/image-to-video",
    name: "MiniMax Image-to-Video",
    supportsImage: true,
  },
  "luma": {
    endpoint: "https://queue.fal.run/fal-ai/luma-dream-machine",
    name: "Luma Dream Machine",
    supportsImage: true,
  },
};

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 10, rateLimitPrefix: "fal-video-gen" },
  async (req, ctx) => {
    const FAL_KEY = Deno.env.get("FAL_KEY");
    if (!FAL_KEY) throw new Error("FAL_KEY não configurada");

    const userId = ctx.userId!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const {
      prompt,
      model = "google-veo-3",
      input_type = "text",
      image_url,
      document_text,
      aspect_ratio = "16:9",
      duration = 5,
    } = body;

    // If document mode, extract prompt from document via Lovable AI
    let finalPrompt = prompt || "";
    if (input_type === "document" && document_text) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: "You are a creative director. Extract a concise, vivid video prompt from the document provided. The prompt should describe a compelling visual scene suitable for AI video generation. Keep it under 200 words. Output ONLY the prompt, nothing else.",
              },
              { role: "user", content: document_text.slice(0, 10000) },
            ],
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          finalPrompt = aiData.choices?.[0]?.message?.content || finalPrompt;
        }
      }
    }

    if (!finalPrompt && !image_url) {
      return new Response(
        JSON.stringify({ error: "Prompt ou imagem são obrigatórios" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Select model
    let selectedModel = model;
    if (input_type === "image" && image_url) {
      if (!FAL_MODELS[selectedModel]?.supportsImage) {
        selectedModel = "kling-2.0";
      }
    }

    const modelConfig = FAL_MODELS[selectedModel] || FAL_MODELS["google-veo-3"];
    console.log("Submitting video generation:", { model: selectedModel, prompt: finalPrompt?.slice(0, 100), input_type, userId });

    // Build fal.ai request body
    const falBody: Record<string, unknown> = {
      prompt: finalPrompt,
      aspect_ratio,
    };

    if (duration && selectedModel !== "google-veo-3") {
      falBody.duration = duration;
    }

    if (input_type === "image" && image_url) {
      falBody.image_url = image_url;
    }

    // Submit to fal.ai queue
    const falRes = await fetch(modelConfig.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(falBody),
    });

    if (!falRes.ok) {
      const errText = await falRes.text();
      console.error("fal.ai error:", falRes.status, errText);

      if (falRes.status === 422) {
        return new Response(
          JSON.stringify({ error: "Parâmetros inválidos para o modelo selecionado. Tente outro modelo." }),
          { status: 422, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      throw new Error(`fal.ai error: ${falRes.status} - ${errText}`);
    }

    const falData = await falRes.json();
    const requestId = falData.request_id;
    const statusUrl = falData.status_url || `${modelConfig.endpoint}/requests/${requestId}/status`;

    console.log("fal.ai job submitted:", { requestId, statusUrl });

    // Save to database
    let videoRecord = null;
    const { data, error } = await supabase.from("generated_videos").insert({
      user_id: userId,
      prompt: finalPrompt,
      model_used: selectedModel,
      input_type,
      status: "processing",
      fal_request_id: requestId,
      duration,
      aspect_ratio,
      metadata: { model_name: modelConfig.name, image_url: image_url || null },
    }).select().single();

    if (error) console.error("DB insert error:", error);
    else videoRecord = data;

    return new Response(
      JSON.stringify({
        success: true,
        requestId,
        statusUrl,
        videoId: videoRecord?.id,
        model: modelConfig.name,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
));
