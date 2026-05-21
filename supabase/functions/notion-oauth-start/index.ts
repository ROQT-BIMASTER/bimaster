// supabase/functions/notion-oauth-start/index.ts
// Starts the Notion OAuth flow for the authenticated user.
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const NOTION_AUTHORIZE_URL = "https://api.notion.com/v1/oauth/authorize";

function getRedirectUri(): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  return `${supabaseUrl}/functions/v1/notion-oauth-callback`;
}

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 10, rateLimitPrefix: "notion-oauth-start" },
    async (req, ctx) => {
      const cors = getCorsHeaders(req);
      const clientId = Deno.env.get("NOTION_OAUTH_CLIENT_ID");
      if (!clientId) {
        return new Response(
          JSON.stringify({ error: "NOTION_OAUTH_CLIENT_ID not configured" }),
          { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      // Cleanup expired states (best-effort, non-blocking)
      sb.from("notion_oauth_states")
        .delete()
        .lt("expires_at", new Date().toISOString())
        .then(() => {});

      const { data, error } = await sb
        .from("notion_oauth_states")
        .insert({ user_id: ctx.userId })
        .select("state")
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Could not initialize OAuth state" }),
          { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      const params = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        owner: "user",
        redirect_uri: getRedirectUri(),
        state: data.state,
      });

      return new Response(
        JSON.stringify({ authorize_url: `${NOTION_AUTHORIZE_URL}?${params}` }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    },
  ),
);
