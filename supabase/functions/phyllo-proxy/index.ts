import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const PHYLLO_BASE = "https://api.getphyllo.com/v1";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const headers = getCorsHeaders(req);
  const jsonHeaders = { ...headers, "Content-Type": "application/json" };

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: jsonHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: jsonHeaders,
      });
    }

    // Phyllo credentials
    const clientId = Deno.env.get("PHYLLO_CLIENT_ID");
    const clientSecret = Deno.env.get("PHYLLO_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({
        error: "phyllo_not_configured",
        message: "Credenciais Phyllo não configuradas. Entre em contato com o administrador.",
      }), { status: 503, headers: jsonHeaders });
    }

    const authToken = btoa(`${clientId}:${clientSecret}`);

    const body = await req.json();
    const { action, ...params } = body;

    let result: unknown;

    switch (action) {
      case "create_user": {
        // Create a Phyllo user to get SDK token
        const res = await fetch(`${PHYLLO_BASE}/users`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: params.name || user.email,
            external_id: user.id,
          }),
        });
        result = await res.json();
        if (!res.ok) throw new Error(`Phyllo create_user failed: ${JSON.stringify(result)}`);
        break;
      }

      case "create_sdk_token": {
        const res = await fetch(`${PHYLLO_BASE}/sdk-tokens`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: params.phyllo_user_id,
            products: params.products || ["IDENTITY", "ENGAGEMENT"],
          }),
        });
        result = await res.json();
        if (!res.ok) throw new Error(`Phyllo sdk_token failed: ${JSON.stringify(result)}`);
        break;
      }

      case "get_profile": {
        const res = await fetch(
          `${PHYLLO_BASE}/social/accounts/${params.account_id}`,
          {
            headers: { Authorization: `Basic ${authToken}` },
          }
        );
        result = await res.json();
        if (!res.ok) throw new Error(`Phyllo get_profile failed: ${JSON.stringify(result)}`);
        break;
      }

      case "get_audience": {
        const res = await fetch(
          `${PHYLLO_BASE}/social/accounts/${params.account_id}/audience`,
          {
            headers: { Authorization: `Basic ${authToken}` },
          }
        );
        result = await res.json();
        break;
      }

      case "get_engagement": {
        const url = new URL(`${PHYLLO_BASE}/social/content/search`);
        url.searchParams.set("account_id", params.account_id);
        if (params.from_date) url.searchParams.set("from_date", params.from_date);
        if (params.to_date) url.searchParams.set("to_date", params.to_date);
        url.searchParams.set("limit", String(params.limit || 10));

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Basic ${authToken}` },
        });
        result = await res.json();
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Ação inválida", valid_actions: [
          "create_user", "create_sdk_token", "get_profile", "get_audience", "get_engagement"
        ] }), { status: 400, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ data: result }), {
      status: 200, headers: jsonHeaders,
    });

  } catch (error) {
    console.error("phyllo-proxy error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: jsonHeaders,
    });
  }
});
