import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { secureHandler } from "../_shared/secure-handler.ts";

Deno.serve(secureHandler({
  auth: "none",
  rateLimit: 10,
  rateLimitPrefix: "create-admin-users",
}, async (req, _ctx) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { users } = await req.json();
    
    if (!users || !Array.isArray(users)) {
      return new Response(
        JSON.stringify({ error: "Invalid users array" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const user of users) {
      const { email, password, nome, role, departamento_id, tela_ids, modulo_id } = user;

      try {
        const gotrue_url = `${supabaseUrl}/auth/v1/admin/users`;
        const response = await fetch(gotrue_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "apikey": supabaseServiceKey,
          },
          body: JSON.stringify({
            email,
            password,
            email_confirm: true,
            user_metadata: { nome, tipo_usuario: role }
          })
        });
        
        const responseBody = await response.text();
        console.log("GoTrue response for", email, "status:", response.status, "body:", responseBody);

        if (!response.ok) {
          results.push({ email, success: false, error: responseBody });
          continue;
        }

        const authData = JSON.parse(responseBody);
        const userId = authData.id;

        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update({ 
            departamento_id, 
            aprovado: true, 
            status: "ativo",
            nome
          })
          .eq("id", userId);

        if (profileError) {
          console.error("Profile update error for", email, ":", JSON.stringify(profileError));
        }

        await supabaseAdmin
          .from("user_roles")
          .upsert({ 
            user_id: userId, 
            role 
          }, { onConflict: "user_id,role" });

        if (modulo_id) {
          await supabaseAdmin
            .from("usuario_permissoes_modulos")
            .insert({ 
              usuario_id: userId, 
              modulo_id 
            });
        }

        if (tela_ids && tela_ids.length > 0) {
          const screenPermissions = tela_ids.map((tela_id: string) => ({
            usuario_id: userId,
            tela_id
          }));
          
          await supabaseAdmin
            .from("usuario_permissoes_telas")
            .insert(screenPermissions);
        }

        results.push({ email, success: true, userId });
      } catch (error: any) {
        console.error("Exception for", email, ":", error.message);
        results.push({ email, success: false, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
}));
