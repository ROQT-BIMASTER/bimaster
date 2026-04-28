import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { secureHandler } from "../_shared/secure-handler.ts";

Deno.serve(secureHandler({
  auth: "none",
  rateLimit: 5,
  rateLimitPrefix: "admin-bulk-set-pwd",
}, async (req, _ctx) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Nao autorizado");

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: caller }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !caller) throw new Error("Nao autorizado");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      throw new Error("Apenas administradores podem aplicar senha em lote");
    }

    const { userIds, newPassword } = await req.json();
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new Error("userIds (array) obrigatorio");
    }
    if (userIds.length > 100) {
      throw new Error("Maximo de 100 usuarios por chamada");
    }
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      throw new Error("Senha deve ter no minimo 8 caracteres");
    }

    const results: Array<{ userId: string; ok: boolean; error?: string }> = [];

    for (const userId of userIds) {
      try {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: newPassword,
        });
        if (error) throw error;
        results.push({ userId, ok: true });
      } catch (e: any) {
        results.push({ userId, ok: false, error: e?.message || String(e) });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.length - okCount;

    return new Response(
      JSON.stringify({ success: failCount === 0, okCount, failCount, results }),
      { headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  }
}));
