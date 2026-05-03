import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { secureHandler } from "../_shared/secure-handler.ts";
import { logSensitiveOperation } from "../_shared/audit-log.ts";

Deno.serve(secureHandler({
  auth: "jwt",
  rateLimit: 10,
  rateLimitPrefix: "update-user-pwd",
  requireMfa: true,
  requireStepUp: "user.password.self",
}, async (req, ctx) => {
  let targetUserId: string | undefined;
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!ctx.userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", ctx.userId)
      .single();

    if (roleError || !roleData || roleData.role !== "admin") {
      await logSensitiveOperation(ctx, req, {
        action: "user.password.self",
        outcome: "denied",
        metadata: { reason: "not_admin" },
      });
      return new Response(
        JSON.stringify({ error: "Access denied. Admin role required." }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const { user_id, password } = await req.json();
    targetUserId = user_id;

    if (!user_id || !password) {
      return new Response(
        JSON.stringify({ error: "user_id and password required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const complexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (!complexityRegex.test(password)) {
      return new Response(
        JSON.stringify({ error: "Password must contain uppercase, lowercase letters and numbers" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password });

    if (error) {
      await logSensitiveOperation(ctx, req, {
        action: "user.password.self",
        target_id: user_id,
        target_type: "user",
        outcome: "failure",
        metadata: { error: error.message },
      });
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    await logSensitiveOperation(ctx, req, {
      action: "user.password.self",
      target_id: user_id,
      target_type: "user",
      outcome: "success",
      metadata: { updated_by: ctx.email ?? null },
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    await logSensitiveOperation(ctx, req, {
      action: "user.password.self",
      target_id: targetUserId ?? null,
      target_type: "user",
      outcome: "failure",
      metadata: { error: error?.message ?? String(error) },
    });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
}));
