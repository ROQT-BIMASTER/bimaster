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
    const phylloHeaders = {
      Authorization: `Basic ${authToken}`,
      "Content-Type": "application/json",
    };

    const body = await req.json();
    const { action, ...params } = body;

    let result: unknown;

    switch (action) {
      // ─── Identity API ───
      case "create_user": {
        const res = await fetch(`${PHYLLO_BASE}/users`, {
          method: "POST",
          headers: phylloHeaders,
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
          headers: phylloHeaders,
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
          { headers: { Authorization: `Basic ${authToken}` } }
        );
        result = await res.json();
        if (!res.ok) throw new Error(`Phyllo get_profile failed: ${JSON.stringify(result)}`);
        break;
      }

      case "get_all_profiles": {
        const url = new URL(`${PHYLLO_BASE}/social/profiles`);
        if (params.user_id) url.searchParams.set("user_id", params.user_id);
        if (params.limit) url.searchParams.set("limit", String(params.limit));
        if (params.offset) url.searchParams.set("offset", String(params.offset));
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Basic ${authToken}` },
        });
        result = await res.json();
        break;
      }

      case "get_all_accounts": {
        const url = new URL(`${PHYLLO_BASE}/social/accounts`);
        if (params.user_id) url.searchParams.set("user_id", params.user_id);
        if (params.work_platform_id) url.searchParams.set("work_platform_id", params.work_platform_id);
        if (params.limit) url.searchParams.set("limit", String(params.limit));
        if (params.offset) url.searchParams.set("offset", String(params.offset));
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Basic ${authToken}` },
        });
        result = await res.json();
        break;
      }

      // ─── Audience API ───
      case "get_audience": {
        const res = await fetch(
          `${PHYLLO_BASE}/social/accounts/${params.account_id}/audience`,
          { headers: { Authorization: `Basic ${authToken}` } }
        );
        result = await res.json();
        break;
      }

      // ─── Engagement API ───
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

      case "get_content_item": {
        const res = await fetch(
          `${PHYLLO_BASE}/social/content/${params.content_id}`,
          { headers: { Authorization: `Basic ${authToken}` } }
        );
        result = await res.json();
        if (!res.ok) throw new Error(`Phyllo get_content_item failed: ${JSON.stringify(result)}`);
        break;
      }

      case "get_comments": {
        const url = new URL(`${PHYLLO_BASE}/social/content/${params.content_id}/comments`);
        if (params.limit) url.searchParams.set("limit", String(params.limit));
        if (params.offset) url.searchParams.set("offset", String(params.offset));
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Basic ${authToken}` },
        });
        result = await res.json();
        break;
      }

      // ─── Income API ───
      case "get_income": {
        const url = new URL(`${PHYLLO_BASE}/social/income/transactions`);
        if (params.account_id) url.searchParams.set("account_id", params.account_id);
        if (params.from_date) url.searchParams.set("from_date", params.from_date);
        if (params.to_date) url.searchParams.set("to_date", params.to_date);
        if (params.limit) url.searchParams.set("limit", String(params.limit));
        if (params.offset) url.searchParams.set("offset", String(params.offset));
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Basic ${authToken}` },
        });
        result = await res.json();
        break;
      }

      case "get_payouts": {
        const url = new URL(`${PHYLLO_BASE}/social/income/payouts`);
        if (params.account_id) url.searchParams.set("account_id", params.account_id);
        if (params.from_date) url.searchParams.set("from_date", params.from_date);
        if (params.to_date) url.searchParams.set("to_date", params.to_date);
        if (params.limit) url.searchParams.set("limit", String(params.limit));
        if (params.offset) url.searchParams.set("offset", String(params.offset));
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Basic ${authToken}` },
        });
        result = await res.json();
        break;
      }

      // ─── Search/Discovery API ───
      case "search_creators": {
        const res = await fetch(`${PHYLLO_BASE}/social/creators/search`, {
          method: "POST",
          headers: phylloHeaders,
          body: JSON.stringify({
            platform: params.platform,
            username: params.username,
            ...(params.work_platform_id && { work_platform_id: params.work_platform_id }),
          }),
        });
        result = await res.json();
        break;
      }

      // ─── Publish API ───
      case "publish_content": {
        const res = await fetch(`${PHYLLO_BASE}/social/content/publish`, {
          method: "POST",
          headers: phylloHeaders,
          body: JSON.stringify({
            account_id: params.account_id,
            type: params.type || "POST",
            title: params.title,
            description: params.description,
            media_url: params.media_url,
            visibility: params.visibility || "PUBLIC",
          }),
        });
        result = await res.json();
        if (!res.ok) throw new Error(`Phyllo publish failed: ${JSON.stringify(result)}`);
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Ação inválida", valid_actions: [
          "create_user", "create_sdk_token", "get_profile", "get_all_profiles", "get_all_accounts",
          "get_audience", "get_engagement", "get_content_item", "get_comments",
          "get_income", "get_payouts", "search_creators", "publish_content"
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
