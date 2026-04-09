import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { secureHandler } from "../_shared/secure-handler.ts";

Deno.serve(secureHandler({
  auth: "none",
  rateLimit: 30,
  rateLimitPrefix: "save-social-acct",
}, async (req, _ctx) => {

  const headers = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { platform, username, account_name, access_token, region, account_group, app_id, app_secret } = body;

    if (!platform || !username || !account_name || !access_token) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: platform, username, account_name, access_token" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Encrypt access token via Vault RPC
    const { data: encryptedToken, error: encryptError } = await supabase.rpc("encrypt_token", {
      p_token: access_token,
    });

    if (encryptError) {
      console.error("Encryption error:", encryptError);
      return new Response(JSON.stringify({ error: "Erro ao criptografar token" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // Encrypt app_secret if provided
    let encryptedAppSecret = null;
    if (app_secret) {
      const { data: encrypted, error: secretEncryptError } = await supabase.rpc("encrypt_token", {
        p_token: app_secret,
      });
      if (secretEncryptError) {
        console.error("App secret encryption error:", secretEncryptError);
        return new Response(JSON.stringify({ error: "Erro ao criptografar App Secret" }), {
          status: 500,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
      encryptedAppSecret = encrypted;
    }

    // Insert account
    const { data: account, error: insertError } = await supabase
      .from("social_media_accounts")
      .insert({
        user_id: user.id,
        platform,
        username,
        account_name,
        access_token_encrypted: encryptedToken,
        region: region || null,
        account_group: account_group || null,
        app_id: app_id || null,
        app_secret_encrypted: encryptedAppSecret,
        status: "active",
      })
      .select("id, platform, username, account_name, status")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: `Erro ao salvar conta: ${insertError.message}` }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, account }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("save-social-account error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Erro interno" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}));
