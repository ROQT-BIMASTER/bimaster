// stitch-proxy — Secure MCP proxy for Google Stitch API
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { z } from "https://esm.sh/zod@3.22.4";

const STITCH_MCP_URL = "https://stitch.googleapis.com/mcp";

// Zod schemas for each action
const CreateProjectSchema = z.object({
  action: z.literal("create_project"),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: z.enum(["web", "mobile"]).default("web"),
});

const ListProjectsSchema = z.object({
  action: z.literal("list_projects"),
});

const GenerateScreenSchema = z.object({
  action: z.literal("generate_screen"),
  project_id: z.string().min(1),
  prompt: z.string().min(1).max(5000),
  model: z.enum(["flash", "pro"]).default("flash"),
});

const GetScreenSchema = z.object({
  action: z.literal("get_screen"),
  project_id: z.string().min(1),
  screen_id: z.string().min(1),
});

const ExportCodeSchema = z.object({
  action: z.literal("export_code"),
  project_id: z.string().min(1),
  screen_id: z.string().min(1),
});

const ListScreensSchema = z.object({
  action: z.literal("list_screens"),
  project_id: z.string().min(1),
});

const ActionSchema = z.discriminatedUnion("action", [
  CreateProjectSchema,
  ListProjectsSchema,
  GenerateScreenSchema,
  GetScreenSchema,
  ExportCodeSchema,
  ListScreensSchema,
]);

// MCP JSON-RPC request builder
function buildMcpRequest(action: string, params: Record<string, unknown>) {
  const toolMap: Record<string, string> = {
    create_project: "create_project",
    list_projects: "list_projects",
    generate_screen: "generate_screen_from_text",
    get_screen: "get_screen",
    export_code: "export_code",
    list_screens: "list_screens",
  };

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

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers });
    }
    const userId = claims.claims.sub as string;

    // Get Stitch API Key
    const stitchKey = Deno.env.get("STITCH_API_KEY");
    if (!stitchKey) {
      return new Response(JSON.stringify({ error: "STITCH_API_KEY não configurada" }), { status: 500, headers });
    }

    // Parse and validate body
    const body = await req.json();
    const parsed = ActionSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Payload inválido", details: parsed.error.flatten().fieldErrors }), { status: 400, headers });
    }

    const { action, ...params } = parsed.data;

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

    // If generate_screen, save to DB
    if (action === "generate_screen") {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const screenData = mcpResult?.result?.content?.[0]?.text;
      let parsedScreen: Record<string, unknown> = {};
      try {
        if (screenData) parsedScreen = JSON.parse(screenData);
      } catch { /* non-JSON response */ }

      await adminClient.from("stitch_designs").insert({
        user_id: userId,
        project_id_stitch: (params as Record<string, string>).project_id,
        screen_id: parsedScreen.screen_id as string || null,
        prompt: (params as Record<string, string>).prompt,
        preview_url: parsedScreen.preview_url as string || null,
        html_code: parsedScreen.html as string || null,
        model_used: (params as Record<string, string>).model || "flash",
      });
    }

    return new Response(JSON.stringify({ success: true, data: mcpResult }), { status: 200, headers });
  } catch (err) {
    console.error("stitch-proxy error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
