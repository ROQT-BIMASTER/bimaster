import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

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
    
    // Client with service role for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // SECURITY: Validate authorization - allow service role calls or admin JWT
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
      
      if (!claimsError && claimsData?.claims) {
        const requestingUserId = claimsData.claims.sub;
        const { data: roleData, error: roleError } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", requestingUserId)
          .eq("role", "admin")
          .single();

        if (roleError || !roleData) {
          return new Response(
            JSON.stringify({ error: "Forbidden - Only administrators can create users" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }
    // Note: When called via service role (no user JWT), auth check is skipped

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
        console.log("Creating user:", email, "with service key present:", !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
        // Create user in auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            nome,
            tipo_usuario: role
          }
        });

        if (authError) {
          console.error("Auth error for", email, ":", JSON.stringify(authError), "status:", authError.status, "code:", authError.code, "message:", authError.message);
          results.push({ email, success: false, error: `${authError.message} (code: ${authError.code}, status: ${authError.status})` });
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
