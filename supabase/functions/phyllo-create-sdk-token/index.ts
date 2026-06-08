import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const PHYLLO_BASE = "https://api.staging.getphyllo.com/v1";

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 60, rateLimitPrefix: "phyllo-create-sdk-token" },
    async (req, ctx) => {
      const cors = getCorsHeaders(req);
      const headers = { ...cors, "Content-Type": "application/json" };

      const clientId = Deno.env.get("PHYLLO_CLIENT_ID");
      const clientSecret = Deno.env.get("PHYLLO_CLIENT_SECRET");
      if (!clientId || !clientSecret) {
        return new Response(
          JSON.stringify({ error: "Credenciais Phyllo não configuradas" }),
          { status: 503, headers }
        );
      }

      // Deriva o phyllo_user_id estritamente do usuário autenticado (proteção IDOR)
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: mapping } = await admin
        .from("phyllo_users")
        .select("phyllo_user_id")
        .eq("user_id", ctx.userId)
        .maybeSingle();

      if (!mapping?.phyllo_user_id) {
        return new Response(
          JSON.stringify({ error: "Usuário Phyllo não inicializado para esta conta" }),
          { status: 404, headers }
        );
      }

      const user_id = mapping.phyllo_user_id;
      const authToken = btoa(`${clientId}:${clientSecret}`);

      const phylloRes = await fetch(`${PHYLLO_BASE}/sdk-tokens`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id,
          products: ["IDENTITY", "ENGAGEMENT", "INCOME", "PUBLISH", "ACTIVITY"],
        }),
      });

      const phylloData = await phylloRes.json();

      if (!phylloRes.ok) {
        return new Response(
          JSON.stringify({ error: "Erro na API Phyllo", details: phylloData }),
          { status: phylloRes.status, headers }
        );
      }

      return new Response(
        JSON.stringify({
          sdk_token: phylloData.sdk_token,
          expires_at: phylloData.expires_at,
        }),
        { headers }
      );
    }
  )
);
