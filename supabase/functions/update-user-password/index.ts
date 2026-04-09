import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { secureHandler } from "../_shared/secure-handler.ts";

Deno.serve(secureHandler({
  auth: "none",
  rateLimit: 10,
  rateLimitPrefix: "update-user-pwd",
}, async (req, _ctx) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: { user: caller }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (roleError || !roleData || roleData.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Access denied. Admin role required." }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const { user_id, password } = await req.json();
    
    if (!user_id || !password) {
      return new Response(
        JSON.stringify({ error: "user_id and password required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const complexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (!complexityRegex.test(password)) {
      return new Response(
        JSON.stringify({ error: "Password must contain uppercase, lowercase letters and numbers" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: password
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    await supabaseAdmin.from("audit_logs").insert({
      user_id: caller.id,
      action: "password_update",
      entity_type: "user",
      entity_id: user_id,
      metadata: { updated_by: caller.email }
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
}));
