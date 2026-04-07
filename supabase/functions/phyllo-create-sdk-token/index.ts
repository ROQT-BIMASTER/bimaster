import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const PHYLLO_BASE = "https://api.staging.getphyllo.com/v1";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const headers = getCorsHeaders(req);
  const jsonHeaders = { ...headers, "Content-Type": "application/json" };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: jsonHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: jsonHeaders });
    }

    const clientId = Deno.env.get("PHYLLO_CLIENT_ID");
    const clientSecret = Deno.env.get("PHYLLO_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: "Credenciais Phyllo não configuradas" }), { status: 503, headers: jsonHeaders });
    }

    const body = await req.json();
    const { user_id } = body;

    if (!user_id) {
      return new Response(JSON.stringify({ error: "Campo 'user_id' (Phyllo user ID) é obrigatório" }), { status: 400, headers: jsonHeaders });
    }

    const authToken = btoa(`${clientId}:${clientSecret}`);

    // Create SDK token in Phyllo API
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
      return new Response(JSON.stringify({ error: "Erro na API Phyllo", details: phylloData }), { status: phylloRes.status, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ sdk_token: phylloData.sdk_token, expires_at: phylloData.expires_at }), { headers: jsonHeaders });
  } catch (err) {
    console.error("phyllo-create-sdk-token error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: jsonHeaders });
  }
});
