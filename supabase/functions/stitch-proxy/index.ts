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
  name: z.string().min(1), // projects/{id}
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
  name: z.string().optional(), // projects/{id}/screens/{id}
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

// Extract screen data from MCP result
function extractScreenData(mcpResult: Record<string, unknown>): {
  screenId: string | null;
  previewUrl: string | null;
  htmlCode: string | null;
} {
  try {
    const content = (mcpResult as any)?.result?.content;
    if (!Array.isArray(content)) return { screenId: null, previewUrl: null, htmlCode: null };

    const textContent = content.find((c: any) => c.type === "text");
    if (!textContent?.text) return { screenId: null, previewUrl: null, htmlCode: null };

    const parsed = JSON.parse(textContent.text);

    // Handle array of screens or single screen
    const screen = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!screen) return { screenId: null, previewUrl: null, htmlCode: null };

    // Extract from Stitch Screen resource format
    const screenId = screen.name?.split("/screens/")[1] || screen.screenId || null;
    const previewUrl = screen.screenshot?.downloadUrl || screen.screenshotUrl || screen.preview_url || null;
    const htmlCode = screen.htmlCode?.downloadUrl || screen.html || screen.html_code || null;

    return { screenId, previewUrl, htmlCode };
  } catch {
    return { screenId: null, previewUrl: null, htmlCode: null };
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
        console.error("Lovable AI error:", aiResponse.status, errText);
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

    // Build MCP request
    const mcpPayload = buildMcpRequest(action, params);

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
      console.error(`Stitch API error ${mcpResponse.status}:`, errText);
      return new Response(JSON.stringify({
        error: "Erro na API do Stitch",
        status: mcpResponse.status,
        detail: errText.slice(0, 500),
      }), { status: mcpResponse.status >= 400 && mcpResponse.status < 500 ? mcpResponse.status : 502, headers });
    }

    const mcpResult = await mcpResponse.json();

    // Check for MCP-level errors
    const isError = mcpResult?.result?.isError === true || mcpResult?.error;
    if (isError) {
      const errorDetail = mcpResult?.error?.message || mcpResult?.result?.content?.[0]?.text || "Erro desconhecido do Stitch";
      console.error("Stitch MCP error:", errorDetail);
      return new Response(JSON.stringify({
        error: "Erro na operação do Stitch",
        detail: typeof errorDetail === "string" ? errorDetail.slice(0, 500) : JSON.stringify(errorDetail).slice(0, 500),
      }), { status: 422, headers });
    }

    // If generate_screen or edit_screens, save to DB
    if (action === "generate_screen" || action === "edit_screens") {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { screenId, previewUrl, htmlCode } = extractScreenData(mcpResult);

      // If htmlCode is a downloadUrl, fetch the actual HTML
      let resolvedHtml = htmlCode;
      if (htmlCode && htmlCode.startsWith("http")) {
        try {
          const htmlResp = await fetch(htmlCode);
          if (htmlResp.ok) resolvedHtml = await htmlResp.text();
        } catch { /* keep URL */ }
      }

      const genParams = params as Record<string, any>;
      await adminClient.from("stitch_designs").insert({
        user_id: userId,
        project_id_stitch: genParams.projectId,
        screen_id: screenId,
        prompt: genParams.prompt,
        preview_url: previewUrl,
        html_code: resolvedHtml,
        model_used: genParams.modelId || "GEMINI_3_FLASH",
      });
    }

    return new Response(JSON.stringify({ success: true, data: mcpResult }), { status: 200, headers });
  } catch (err) {
    console.error("stitch-proxy error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), { status: 500, headers });
  }
});
