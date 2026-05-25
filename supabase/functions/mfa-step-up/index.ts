// mfa-step-up — Issues a single-use token (TTL 5min) after re-verifying TOTP
// Used to authorize sensitive actions (payments, role changes, exports).
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { verifyTotp, sha256Hex } from "../_shared/totp.ts";

interface Body {
  action: "request" | "validate";
  code?: string;
  scope: string; // ex: 'finance.payment', 'admin.role_change'
  token?: string;
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 30, rateLimitPrefix: "mfa-step-up", skipMfaEnforcement: true },
  async (req, ctx) => {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userId = ctx.userId!;
    const body = await req.json() as Body;
    if (!body.scope || typeof body.scope !== "string") {
      return json({ error: "scope obrigatório" }, 400);
    }

    if (body.action === "request") {
      if (!body.code || !/^\d{6}$/.test(body.code)) {
        return json({ error: "Código TOTP obrigatório" }, 400);
      }
      const { data: enr } = await sb.from("mfa_enrollments")
        .select("secret_encrypted, verified").eq("user_id", userId).maybeSingle();
      if (!enr || !enr.verified) {
        return json({ error: "MFA não configurado" }, 412);
      }
      const ok = await verifyTotp(enr.secret_encrypted, body.code);
      if (!ok) {
        await sb.from("security_events").insert({
          event_type: "step_up.fail", user_id: userId, severity: "warn",
          payload: { scope: body.scope },
        }).then(() => {}, () => {});
        return json({ error: "Código incorreto" }, 401);
      }
      const tokenBuf = new Uint8Array(32);
      crypto.getRandomValues(tokenBuf);
      const token = Array.from(tokenBuf).map((b) => b.toString(16).padStart(2, "0")).join("");
      const tokenHash = await sha256Hex(token);
      const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await sb.from("mfa_step_up_tokens").insert({
        user_id: userId, token_hash: tokenHash, scope: body.scope, expires_at: expires,
      });
      return json({ token, expires_at: expires });
    }

    if (body.action === "validate") {
      if (!body.token) return json({ error: "token obrigatório" }, 400);
      const tokenHash = await sha256Hex(body.token);
      const { data } = await sb.rpc("validate_step_up_token", {
        _uid: userId, _token_hash: tokenHash, _scope: body.scope,
      });
      return json({ valid: !!data });
    }

    return json({ error: "Ação inválida" }, 400);
  },
));

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json" },
  });
}
