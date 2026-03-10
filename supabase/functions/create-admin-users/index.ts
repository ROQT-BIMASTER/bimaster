import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // SECURITY: Validate authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Client with service role for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Allow service_role key OR validate user JWT as admin
    const isServiceRole = token === supabaseServiceKey;
    
    if (!isServiceRole) {
      // Create client with user's token to verify their identity
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      // Verify the user's JWT and get their claims
      const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
      
      if (claimsError || !claimsData?.claims) {
        return new Response(
          JSON.stringify({ error: "Unauthorized - Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const requestingUserId = claimsData.claims.sub;

      // SECURITY: Verify the requesting user is an admin
      const { data: roleData, error: roleError } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", requestingUserId)
        .eq("role", "admin")
        .single();

      if (roleError || !roleData) {
        console.error("Unauthorized attempt to create admin users by:", requestingUserId);
        return new Response(
          JSON.stringify({ error: "Forbidden - Only administrators can create users" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

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
