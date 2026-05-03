import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { secureHandler } from "../_shared/secure-handler.ts";
import { logSensitiveOperation } from "../_shared/audit-log.ts";

Deno.serve(secureHandler({
  auth: "jwt",
  rateLimit: 10,
  rateLimitPrefix: "admin-reset-pwd",
  // requireMfa: true, // TODO: enable after frontend wires step-up
  // requireStepUp: "user.password.reset", // TODO: enable after frontend wires step-up
}, async (req, ctx) => {
  let targetUserId: string | undefined;
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    if (!ctx.userId) throw new Error("Nao autorizado");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", ctx.userId)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      await logSensitiveOperation(ctx, req, {
        action: "user.password.reset",
        outcome: "denied",
        metadata: { reason: "not_admin" },
      });
      throw new Error("Apenas administradores podem resetar senhas");
    }

    const { userId, newPassword } = await req.json();
    targetUserId = userId;
    if (!userId || !newPassword) throw new Error("userId e newPassword sao obrigatorios");
    if (newPassword.length < 8) throw new Error("Senha deve ter no minimo 8 caracteres");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) throw error;

    await logSensitiveOperation(ctx, req, {
      action: "user.password.reset",
      target_id: userId,
      target_type: "user",
      outcome: "success",
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  } catch (error: any) {
    await logSensitiveOperation(ctx, req, {
      action: "user.password.reset",
      target_id: targetUserId ?? null,
      target_type: "user",
      outcome: "failure",
      metadata: { error: error?.message ?? String(error) },
    });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  }
}));
