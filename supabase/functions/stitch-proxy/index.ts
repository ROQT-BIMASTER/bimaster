// stitch-proxy — Secure MCP proxy for Google Stitch API
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { z } from "https://esm.sh/zod@3.22.4";

const STITCH_MCP_URL = "https://stitch.googleapis.com/mcp";

const ModelIdEnum = z.enum(["GEMINI_3_FLASH", "GEMINI_3_1_PRO"]).default("GEMINI_3_FLASH");
const DeviceTypeEnum = z.enum(["DESKTOP", "MOBILE", "TABLET"]).default("DESKTOP");

// Zod schemas for each action — using correct Stitch API parameter names
const CreateProjectSchema = z.object({
  action: z.literal("create_project"),
  title: z.string().min(1).max(200),
});

const ListProjectsSchema = z.object({
  action: z.literal("list_projects"),
  filter: z.string().optional(),
});

const GetProjectSchema = z.object({
  action: z.literal("get_project"),
  name: z.string().min(1),
});

const GenerateScreenSchema = z.object({
  action: z.literal("generate_screen"),
  projectId: z.string().min(1),
  prompt: z.string().min(1).max(5000),
  modelId: ModelIdEnum,
  deviceType: DeviceTypeEnum,
});

const EditScreensSchema = z.object({
  action: z.literal("edit_screens"),
  projectId: z.string().min(1),
  selectedScreenIds: z.array(z.string().min(1)).min(1),
  prompt: z.string().min(1).max(5000),
  modelId: ModelIdEnum,
  deviceType: DeviceTypeEnum,
});

const GenerateVariantsSchema = z.object({
  action: z.literal("generate_variants"),
  projectId: z.string().min(1),
  selectedScreenIds: z.array(z.string().min(1)).min(1),
  prompt: z.string().max(5000).optional(),
  variantOptions: z.object({
    numberOfVariants: z.number().min(1).max(4).default(2),
  }).optional(),
  modelId: ModelIdEnum,
});

const GetScreenSchema = z.object({
  action: z.literal("get_screen"),
  name: z.string().optional(),
  projectId: z.string().optional(),
  screenId: z.string().optional(),
});

const ListScreensSchema = z.object({
  action: z.literal("list_screens"),
  projectId: z.string().min(1),
});

const DescribeImageSchema = z.object({
  action: z.literal("describe_image"),
  imageBase64: z.string().min(1),
});

const RefreshDesignSchema = z.object({
  action: z.literal("refresh_design"),
  designId: z.string().uuid(),
});

const ActionSchema = z.discriminatedUnion("action", [
  CreateProjectSchema,
  ListProjectsSchema,
  GetProjectSchema,
  GenerateScreenSchema,
  EditScreensSchema,
  GenerateVariantsSchema,
  GetScreenSchema,
  ListScreensSchema,
  DescribeImageSchema,
  RefreshDesignSchema,
]);

// Map action → MCP tool name
const toolMap: Record<string, string> = {
  create_project: "create_project",
  list_projects: "list_projects",
  get_project: "get_project",
  generate_screen: "generate_screen_from_text",
  edit_screens: "edit_screens",
  generate_variants: "generate_variants",
  get_screen: "get_screen",
  list_screens: "list_screens",
};

function buildMcpRequest(action: string, params: Record<string, unknown>) {
  return {
    jsonrpc: "2.0",
    id: crypto.randomUUID(),
    method: "tools/call",
    params: {
      name: toolMap[action] || action,
      arguments: params,
    },
  };
}

// Extract screen data from MCP result — tries multiple extraction paths
function extractScreenData(mcpResult: Record<string, unknown>): {
  screenId: string | null;
  previewUrl: string | null;
  htmlCode: string | null;
} {
  try {
    // Log raw result structure for diagnostics
    logger.log("[extractScreenData] Raw MCP result keys:", JSON.stringify(Object.keys(mcpResult || {})));
    
    const result = (mcpResult as any)?.result;
    logger.log("[extractScreenData] result keys:", JSON.stringify(Object.keys(result || {})));
    
    const content = result?.content;
    logger.log("[extractScreenData] content type:", typeof content, "isArray:", Array.isArray(content), "length:", Array.isArray(content) ? content.length : "N/A");

    if (!Array.isArray(content) || content.length === 0) {
      logger.warn("[extractScreenData] No content array found. Full result:", JSON.stringify(mcpResult).slice(0, 2000));
      return { screenId: null, previewUrl: null, htmlCode: null };
    }

    // Log all content items
    content.forEach((c: any, i: number) => {
      logger.log(`[extractScreenData] content[${i}].type = ${c.type}, text length = ${c.text?.length || 0}`);
    });

    const textContent = content.find((c: any) => c.type === "text");
    if (!textContent?.text) {
      // Try image content as preview
      const imageContent = content.find((c: any) => c.type === "image" || c.type === "resource");
      if (imageContent) {
        logger.log("[extractScreenData] Found image/resource content:", JSON.stringify(imageContent).slice(0, 500));
      }
      logger.warn("[extractScreenData] No text content found");
      return { screenId: null, previewUrl: null, htmlCode: null };
    }

    logger.log("[extractScreenData] Raw text content (first 1000 chars):", textContent.text.slice(0, 1000));

    let parsed: any;
    try {
      parsed = JSON.parse(textContent.text);
    } catch {
      // Text might be raw HTML
      if (textContent.text.trim().startsWith("<") || textContent.text.includes("<!DOCTYPE")) {
        logger.log("[extractScreenData] Text content appears to be raw HTML");
        return { screenId: null, previewUrl: null, htmlCode: textContent.text };
      }
      logger.warn("[extractScreenData] Could not parse text as JSON, returning as html_code for debug");
      return { screenId: null, previewUrl: null, htmlCode: textContent.text };
    }

    logger.log("[extractScreenData] Parsed JSON keys:", JSON.stringify(Object.keys(parsed || {})));

    // Handle array of screens or single screen
    const screen = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!screen) return { screenId: null, previewUrl: null, htmlCode: null };

    logger.log("[extractScreenData] Screen object keys:", JSON.stringify(Object.keys(screen)));

    // Extract from multiple possible paths
    const screenId = screen.name?.split("/screens/")[1] 
      || screen.screenId 
      || screen.screen_id 
      || screen.id 
      || null;

    const previewUrl = screen.screenshot?.downloadUrl 
      || screen.screenshot?.url 
      || screen.screenshotUrl 
      || screen.screenshot_url 
      || screen.preview_url 
      || screen.previewUrl
      || screen.imageUrl
      || screen.image_url
      || null;

    const htmlCode = screen.htmlCode?.downloadUrl 
      || screen.htmlCode?.url
      || (typeof screen.htmlCode === "string" ? screen.htmlCode : null)
      || screen.html_code 
      || screen.html 
      || screen.code
      || null;

    logger.log("[extractScreenData] Extracted:", { screenId, previewUrl: previewUrl?.slice(0, 80), htmlCode: htmlCode?.slice(0, 80) });

    return { screenId, previewUrl, htmlCode };
  } catch (err) {
    logger.error("[extractScreenData] Exception:", err);
    // Save raw response as fallback
    try {
      return { screenId: null, previewUrl: null, htmlCode: JSON.stringify(mcpResult).slice(0, 50000) };
    } catch {
      return { screenId: null, previewUrl: null, htmlCode: null };
    }
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    // Auth: validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers });
    }
    const userId = user.id;

    // Parse and validate body
    const body = await req.json();
    const parsed = ActionSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Payload inválido", details: parsed.error.flatten().fieldErrors }), { status: 400, headers });
    }

    const { action, ...params } = parsed.data;

    // Handle describe_image separately — uses Lovable AI, not Stitch
    if (action === "describe_image") {
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (!lovableKey) {
        return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), { status: 500, headers });
      }

      const { imageBase64 } = params as { imageBase64: string };
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "You are a UI/UX design expert. Analyze the provided image and generate an extremely detailed description of its visual elements, layout, colors, typography, spacing, and structure. The description should be detailed enough to recreate the design. Write in English.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Describe this UI design/image in extreme detail so it can be recreated:" },
                { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } },
              ],
            },
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        logger.error("Lovable AI error:", aiResponse.status, errText);
        return new Response(JSON.stringify({ error: "Erro ao analisar imagem" }), { status: 502, headers });
      }

      const aiResult = await aiResponse.json();
      const description = aiResult.choices?.[0]?.message?.content || "";
      return new Response(JSON.stringify({ success: true, description }), { status: 200, headers });
    }

    // Get Stitch API Key
    const stitchKey = Deno.env.get("STITCH_API_KEY");
    if (!stitchKey) {
      return new Response(JSON.stringify({ error: "STITCH_API_KEY não configurada" }), { status: 500, headers });
    }

    // Handle refresh_design — re-fetch a saved design to populate missing html/preview
    if (action === "refresh_design") {
      const { designId } = params as { designId: string };
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: design, error: dErr } = await adminClient
        .from("stitch_designs")
        .select("id, user_id, project_id_stitch, screen_id, html_code, preview_url")
        .eq("id", designId)
        .maybeSingle();

      if (dErr || !design) {
        return new Response(JSON.stringify({ error: "Design não encontrado" }), { status: 404, headers });
      }
      if (design.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Sem permissão para este design" }), { status: 403, headers });
      }
      if (!design.project_id_stitch || !design.screen_id) {
        return new Response(JSON.stringify({
          error: "Este design não possui referências do Stitch (projectId/screenId). Não é possível atualizar — gere novamente.",
        }), { status: 422, headers });
      }

      // Call Stitch get_screen
      const getPayload = buildMcpRequest("get_screen", { projectId: design.project_id_stitch, screenId: design.screen_id });
      const sResp = await fetch(STITCH_MCP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream", "X-Goog-Api-Key": stitchKey },
        body: JSON.stringify(getPayload),
      });

      if (!sResp.ok) {
        const txt = await sResp.text();
        logger.error("[refresh_design] get_screen failed:", sResp.status, txt.slice(0, 300));
        return new Response(JSON.stringify({ error: "Falha ao consultar Stitch", detail: txt.slice(0, 300) }), { status: 502, headers });
      }

      const sResult = await sResp.json();
      const { previewUrl, htmlCode } = extractScreenData(sResult);

      // Resolve HTML if it's a URL
      let resolvedHtml = htmlCode;
      if (htmlCode && htmlCode.startsWith("http")) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const c = new AbortController();
            const t = setTimeout(() => c.abort(), 8000);
            const r = await fetch(htmlCode, { signal: c.signal });
            clearTimeout(t);
            if (r.ok) { resolvedHtml = await r.text(); break; }
          } catch (e) { logger.warn("[refresh_design] html fetch failed:", e); }
          if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        }
      }

      const updates: Record<string, unknown> = {};
      if (resolvedHtml && (!design.html_code || design.html_code.length < 50)) updates.html_code = resolvedHtml;
      if (previewUrl && !design.preview_url) updates.preview_url = previewUrl;

      if (Object.keys(updates).length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: "O design ainda não está disponível no Stitch. Aguarde alguns instantes e tente novamente, ou gere um novo design.",
        }), { status: 200, headers });
      }

      const { error: uErr } = await adminClient.from("stitch_designs").update(updates).eq("id", designId);
      if (uErr) {
        logger.error("[refresh_design] update error:", uErr);
        return new Response(JSON.stringify({ error: "Erro ao salvar atualização" }), { status: 500, headers });
      }

      return new Response(JSON.stringify({
        success: true,
        updated: Object.keys(updates),
        previewUrl: updates.preview_url || null,
        hasHtml: !!updates.html_code,
      }), { status: 200, headers });
    }

    // Build MCP request
    const mcpPayload = buildMcpRequest(action, params);
    logger.log("[stitch-proxy] Calling Stitch MCP:", action, JSON.stringify(params).slice(0, 200));

    // Call Stitch MCP API
    const mcpResponse = await fetch(STITCH_MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "X-Goog-Api-Key": stitchKey,
      },
      body: JSON.stringify(mcpPayload),
    });

    if (!mcpResponse.ok) {
      const errText = await mcpResponse.text();
      logger.error(`Stitch API error ${mcpResponse.status}:`, errText);
      return new Response(JSON.stringify({
        error: "Erro na API do Stitch",
        status: mcpResponse.status,
        detail: errText.slice(0, 500),
      }), { status: mcpResponse.status >= 400 && mcpResponse.status < 500 ? mcpResponse.status : 502, headers });
    }

    const mcpResult = await mcpResponse.json();
    logger.log("[stitch-proxy] MCP response received, keys:", JSON.stringify(Object.keys(mcpResult)));

    // Check for MCP-level errors
    const isError = mcpResult?.result?.isError === true || mcpResult?.error;
    if (isError) {
      const errorDetail = mcpResult?.error?.message || mcpResult?.result?.content?.[0]?.text || "Erro desconhecido do Stitch";
      logger.error("Stitch MCP error:", errorDetail);
      return new Response(JSON.stringify({
        error: "Erro na operação do Stitch",
        detail: typeof errorDetail === "string" ? errorDetail.slice(0, 500) : JSON.stringify(errorDetail).slice(0, 500),
      }), { status: 422, headers });
    }

    // If generate_screen or edit_screens, save to DB
    if (action === "generate_screen" || action === "edit_screens") {
      // IMPORTANT: declare genParams BEFORE using it in the fallback block
      const genParams = params as Record<string, any>;
      
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { screenId, previewUrl, htmlCode } = extractScreenData(mcpResult);
      logger.log("[stitch-proxy] Extracted screen data:", { screenId, previewUrl: previewUrl?.slice(0, 80), htmlCode: htmlCode?.slice(0, 80) });

      // If htmlCode is a downloadUrl, fetch the actual HTML with retry
      let resolvedHtml = htmlCode;
      if (htmlCode && htmlCode.startsWith("http")) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            logger.log(`[stitch-proxy] Fetching HTML from URL, attempt ${attempt + 1}: ${htmlCode.slice(0, 80)}...`);
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const htmlResp = await fetch(htmlCode, { signal: controller.signal });
            clearTimeout(timeout);
            if (htmlResp.ok) {
              resolvedHtml = await htmlResp.text();
              logger.log(`[stitch-proxy] HTML fetched successfully (${resolvedHtml.length} chars)`);
              break;
            }
            logger.warn(`[stitch-proxy] HTML fetch returned ${htmlResp.status}`);
          } catch (fetchErr) {
            logger.warn(`[stitch-proxy] HTML fetch attempt ${attempt + 1} failed:`, fetchErr);
            if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          }
        }
        // If still a URL after retries, try get_screen as fallback
        if (resolvedHtml && resolvedHtml.startsWith("http") && screenId) {
          logger.log("[stitch-proxy] HTML URL unresolved, trying get_screen fallback...");
          try {
            const getScreenPayload = buildMcpRequest("get_screen", { projectId: genParams.projectId, screenId });
            const screenResp = await fetch(STITCH_MCP_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream", "X-Goog-Api-Key": stitchKey },
              body: JSON.stringify(getScreenPayload),
            });
            if (screenResp.ok) {
              const screenResult = await screenResp.json();
              const extracted = extractScreenData(screenResult);
              if (extracted.htmlCode && !extracted.htmlCode.startsWith("http")) {
                resolvedHtml = extracted.htmlCode;
                logger.log("[stitch-proxy] get_screen fallback resolved HTML");
              }
            }
          } catch (e) { logger.warn("[stitch-proxy] get_screen fallback failed:", e); }
        }
      }

      const { error: insertErr } = await adminClient.from("stitch_designs").insert({
        user_id: userId,
        project_id_stitch: genParams.projectId,
        screen_id: screenId,
        prompt: genParams.prompt,
        preview_url: previewUrl,
        html_code: resolvedHtml,
        model_used: genParams.modelId || "GEMINI_3_FLASH",
      });
      
      if (insertErr) {
        logger.error("[stitch-proxy] DB insert error:", insertErr);
      } else {
        logger.log("[stitch-proxy] Design saved to DB successfully");
      }
    }

    return new Response(JSON.stringify({ success: true, data: mcpResult }), { status: 200, headers });
  } catch (err) {
    logger.error("stitch-proxy error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), { status: 500, headers });
  }
});
