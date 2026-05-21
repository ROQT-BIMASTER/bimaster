// supabase/functions/notion-disconnect/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 5, rateLimitPrefix: "notion-disconnect" },
    async (req, ctx) => {
      const cors = getCorsHeaders(req);
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { error } = await sb
        .from("notion_connections")
        .delete()
        .eq("user_id", ctx.userId);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    },
  ),
);
