import { createClient } from "npm:@supabase/supabase-js@2";
import { logger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { secureHandler } from "../_shared/secure-handler.ts";
import { logSensitiveOperation } from "../_shared/audit-log.ts";

Deno.serve(secureHandler({
  auth: "jwt",
  rateLimit: 10,
  rateLimitPrefix: "create-admin-users",
  requireMfa: true,
  requireStepUp: "user.create.admin",
  mfaFailMode: "closed",
}, async (req, ctx) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Apenas admins podem criar novos usuários (qualquer role, incluindo admin)
    if (!ctx.userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", ctx.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!callerRole) {
      await logSensitiveOperation(ctx, req, {
        action: "user.create.admin",
        outcome: "denied",
        metadata: { reason: "not_admin" },
      });
      return new Response(
        JSON.stringify({ error: "Forbidden: admin role required" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

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
        logger.log("GoTrue response for", email, "status:", response.status, "body:", responseBody);

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
          logger.error("Profile update error for", email, ":", JSON.stringify(profileError));
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
        logger.error("Exception for", email, ":", error.message);
        results.push({ email, success: false, error: error.message });
      }
    }

    const okCount = results.filter((r: any) => r.success).length;
    const failCount = results.length - okCount;

    await logSensitiveOperation(ctx, req, {
      action: "user.create.admin",
      target_type: "user",
      outcome: failCount === 0 ? "success" : "failure",
      metadata: {
        total: results.length,
        ok_count: okCount,
        fail_count: failCount,
        emails: results.map((r: any) => r.email),
      },
    });

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    logger.error("Error:", error);
    await logSensitiveOperation(ctx, req, {
      action: "user.create.admin",
      outcome: "failure",
      metadata: { error: error?.message ?? String(error) },
    });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
}));
