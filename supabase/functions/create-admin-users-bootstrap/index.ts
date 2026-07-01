// Bootstrap variant of create-admin-users. Enforces the SAME MFA + step-up
// guards as the production `create-admin-users` function; the only reason this
// function still exists is to keep its distinct rate-limit bucket and audit
// tag (`user.create.admin.bootstrap`).
import { createClient } from "npm:@supabase/supabase-js@2";
import { logger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { secureHandler } from "../_shared/secure-handler.ts";
import { logSensitiveOperation } from "../_shared/audit-log.ts";

Deno.serve(secureHandler({
  auth: "jwt",
  requireMfa: true,
  requireStepUp: "user.create.admin",
  mfaFailMode: "closed",
  rateLimit: 10,
  rateLimitPrefix: "create-admin-users-bootstrap",
}, async (req, ctx) => {

  const cors = getCorsHeaders(req);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (!ctx.userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const { data: callerRole } = await supabaseAdmin
      .from("user_roles").select("role")
      .eq("user_id", ctx.userId).eq("role", "admin").maybeSingle();
    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { users } = await req.json();
    if (!users || !Array.isArray(users)) {
      return new Response(JSON.stringify({ error: "Invalid users array" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
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
            email, password, email_confirm: true,
            user_metadata: { nome, tipo_usuario: role },
          }),
        });
        const responseBody = await response.text();
        logger.log("GoTrue", email, response.status, responseBody);

        let userId: string | undefined;
        if (!response.ok) {
          // If user already exists, look up by email and continue with permissions
          if (response.status === 422 || responseBody.includes("already")) {
            const { data: existing } = await supabaseAdmin
              .from("profiles").select("id").eq("email", email).maybeSingle();
            if (existing?.id) userId = existing.id;
          }
          if (!userId) {
            results.push({ email, success: false, error: responseBody });
            continue;
          }
        } else {
          userId = JSON.parse(responseBody).id;
        }

        await supabaseAdmin.from("profiles").update({
          departamento_id, aprovado: true, status: "ativo", nome,
        }).eq("id", userId);

        await supabaseAdmin.from("user_roles").upsert(
          { user_id: userId, role }, { onConflict: "user_id,role" },
        );

        if (modulo_id) {
          await supabaseAdmin.from("usuario_permissoes_modulos")
            .upsert({ usuario_id: userId, modulo_id }, { onConflict: "usuario_id,modulo_id" });
        }
        if (tela_ids?.length) {
          const rows = tela_ids.map((tela_id: string) => ({ usuario_id: userId, tela_id }));
          await supabaseAdmin.from("usuario_permissoes_telas")
            .upsert(rows, { onConflict: "usuario_id,tela_id" });
        }

        results.push({ email, success: true, userId });
      } catch (error: any) {
        logger.error("Exception", email, error?.message);
        results.push({ email, success: false, error: error?.message });
      }
    }

    const okCount = results.filter(r => r.success).length;
    await logSensitiveOperation(ctx, req, {
      action: "user.create.admin.bootstrap",
      target_type: "user",
      outcome: okCount === results.length ? "success" : "failure",
      metadata: { total: results.length, ok_count: okCount, emails: results.map(r => r.email) },
    });

    return new Response(JSON.stringify({ results }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    logger.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
}));
