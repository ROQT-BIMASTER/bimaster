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
    const { name, external_id } = body;

    if (!name) {
      return new Response(JSON.stringify({ error: "Campo 'name' é obrigatório" }), { status: 400, headers: jsonHeaders });
    }

    const authToken = btoa(`${clientId}:${clientSecret}`);

    // Check if user already exists in phyllo_users
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: existing } = await adminClient
      .from("phyllo_users")
      .select("phyllo_user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ id: existing.phyllo_user_id, already_exists: true }), { headers: jsonHeaders });
    }

    // Create user in Phyllo API
    const phylloRes = await fetch(`${PHYLLO_BASE}/users`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        external_id: external_id || user.id,
      }),
    });

    const phylloData = await phylloRes.json();

    if (!phylloRes.ok) {
      return new Response(JSON.stringify({ error: "Erro na API Phyllo", details: phylloData }), { status: phylloRes.status, headers: jsonHeaders });
    }

    // Save mapping
    await adminClient.from("phyllo_users").insert({
      user_id: user.id,
      phyllo_user_id: phylloData.id,
      external_id: external_id || user.id,
    });

    return new Response(JSON.stringify({ id: phylloData.id, name: phylloData.name }), { headers: jsonHeaders });
  } catch (err) {
    console.error("phyllo-create-user error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: jsonHeaders });
  }
});
