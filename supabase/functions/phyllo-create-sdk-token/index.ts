import { secureHandler } from "../_shared/secure-handler.ts";
import { z, validateBody } from "../_shared/validate.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const PHYLLO_BASE = "https://api.staging.getphyllo.com/v1";

const SdkTokenSchema = z
  .object({
    user_id: z.string().min(1).max(200),
  })
  .strict();

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 60, rateLimitPrefix: "phyllo-create-sdk-token" },
    async (req) => {
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

      const body = await req.json().catch(() => ({}));
      const { user_id } = validateBody(body, SdkTokenSchema);

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
