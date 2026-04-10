import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 60, rateLimitPrefix: "fal-video-status" },
  async (req, ctx) => {
    const FAL_KEY = Deno.env.get("FAL_KEY");
    if (!FAL_KEY) throw new Error("FAL_KEY não configurada");

    const { requestId, videoId, model } = await req.json();
    if (!requestId) {
      return new Response(
        JSON.stringify({ error: "requestId é obrigatório" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Determine the correct status endpoint based on model
    const modelEndpoints: Record<string, string> = {
      "google-veo-3": "fal-ai/veo3",
      "kling-2.0": "fal-ai/kling-video/v2/master",
      "minimax-text": "fal-ai/minimax-video",
      "minimax-image": "fal-ai/minimax-video/image-to-video",
      "luma": "fal-ai/luma-dream-machine",
    };

    const modelPath = modelEndpoints[model] || "fal-ai/veo3";
    const statusUrl = `https://queue.fal.run/${modelPath}/requests/${requestId}/status`;

    console.log("Checking status:", statusUrl);

    const statusRes = await fetch(statusUrl, {
      method: "GET",
      headers: { Authorization: `Key ${FAL_KEY}` },
    });

    if (!statusRes.ok) {
      const errText = await statusRes.text();
      console.error("Status check error:", statusRes.status, errText);
      throw new Error(`Status check failed: ${statusRes.status}`);
    }

    const statusData = await statusRes.json();
    console.log("Status response:", JSON.stringify(statusData).slice(0, 500));

    // Map fal.ai status
    let status = "processing";
    let videoUrl = null;
    let progress = 0;

    if (statusData.status === "COMPLETED") {
      status = "completed";
      progress = 100;

      // Fetch the result
      const resultUrl = `https://queue.fal.run/${modelPath}/requests/${requestId}`;
      const resultRes = await fetch(resultUrl, {
        method: "GET",
        headers: { Authorization: `Key ${FAL_KEY}` },
      });

      if (resultRes.ok) {
        const resultData = await resultRes.json();
        videoUrl = resultData.video?.url || resultData.data?.video?.url || resultData.output?.video || null;
        console.log("Video URL:", videoUrl);
      }
    } else if (statusData.status === "FAILED") {
      status = "failed";
    } else if (statusData.status === "IN_PROGRESS") {
      status = "processing";
      progress = statusData.progress || 50;
    } else if (statusData.status === "IN_QUEUE") {
      status = "pending";
      progress = 10;
    }

    // Update database if we have a videoId and status changed
    if (videoId && (status === "completed" || status === "failed")) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const updateData: Record<string, unknown> = { status };
      if (videoUrl) updateData.video_url = videoUrl;
      if (status === "failed") updateData.error_message = statusData.error || "Falha na geração";

      await supabase.from("generated_videos").update(updateData).eq("id", videoId);
    }

    return new Response(
      JSON.stringify({ status, videoUrl, progress, rawStatus: statusData.status }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
));
