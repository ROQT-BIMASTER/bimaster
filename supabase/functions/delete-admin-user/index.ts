import { createClient } from "npm:@supabase/supabase-js@2";
import { logger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { secureHandler } from "../_shared/secure-handler.ts";
import { logSensitiveOperation } from "../_shared/audit-log.ts";

Deno.serve(secureHandler({
  auth: "jwt",
  rateLimit: 10,
  rateLimitPrefix: "delete-admin-user",
  requireMfa: true,
  requireStepUp: "user.delete",
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

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", ctx.userId)
      .eq("role", "admin");

    if (!roleData || roleData.length === 0) {
      await logSensitiveOperation(ctx, req, {
        action: "user.delete",
        outcome: "denied",
        metadata: { reason: "not_admin" },
      });
      return new Response(
        JSON.stringify({ error: "Only admins can delete users" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const { user_id } = await req.json();
    targetUserId = user_id;

    if (!user_id || typeof user_id !== "string") {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    if (user_id === ctx.userId) {
      return new Response(
        JSON.stringify({ error: "You cannot delete your own account" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (deleteError) throw deleteError;

    await logSensitiveOperation(ctx, req, {
      action: "user.delete",
      target_id: user_id,
      target_type: "user",
      outcome: "success",
      metadata: { deleted_by: ctx.email ?? null },
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    logger.error("Error deleting user:", error);
    await logSensitiveOperation(ctx, req, {
      action: "user.delete",
      target_id: targetUserId ?? null,
      target_type: "user",
      outcome: "failure",
      metadata: { error: error?.message ?? String(error) },
    });
    return new Response(
      JSON.stringify({ error: error.message || "Failed to delete user" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
}));
