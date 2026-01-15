import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Client with service role for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { users } = await req.json();
    
    if (!users || !Array.isArray(users)) {
      return new Response(
        JSON.stringify({ error: "Invalid users array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const user of users) {
      const { email, password, nome, role, departamento_id, tela_ids, modulo_id } = user;

      try {
        // Create user in auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            nome,
            tipo_usuario: role
          }
        });

        if (authError) {
          results.push({ email, success: false, error: authError.message });
          continue;
        }

        const userId = authData.user.id;

        // Update profile with department
        await supabaseAdmin
          .from("profiles")
          .update({ 
            departamento_id, 
            aprovado: true, 
            status: "ativo",
            nome
          })
          .eq("id", userId);

        // Insert user role
        await supabaseAdmin
          .from("user_roles")
          .upsert({ 
            user_id: userId, 
            role 
          }, { onConflict: "user_id" });

        // Insert module permission
        if (modulo_id) {
          await supabaseAdmin
            .from("usuario_permissoes_modulos")
            .insert({ 
              usuario_id: userId, 
              modulo_id 
            });
        }

        // Insert screen permissions
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
        results.push({ email, success: false, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
