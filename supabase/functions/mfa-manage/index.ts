// mfa-manage — Enroll, verify, disable TOTP MFA + recovery codes
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import {
  generateBase32Secret,
  buildOtpauthUri,
  verifyTotp,
  sha256Hex,
  generateRecoveryCodes,
} from "../_shared/totp.ts";

interface Body {
  action: "enroll" | "verify" | "disable" | "status";
  code?: string;
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 20, rateLimitPrefix: "mfa-manage" },
  async (req, ctx) => {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userId = ctx.userId!;
    let body: Body;
    try { body = await req.json(); } catch { body = { action: "status" }; }

    if (body.action === "status") {
      const { data } = await sb.from("mfa_enrollments")
        .select("verified, verified_at, last_used_at")
        .eq("user_id", userId).maybeSingle();
      const { data: req2 } = await sb.rpc("user_requires_mfa", { _uid: userId });
      return json({ enrolled: !!data, verified: !!data?.verified, required: !!req2, ...data });
    }

    if (body.action === "enroll") {
      const secret = generateBase32Secret();
      const recovery = generateRecoveryCodes(10);
      const recoveryHashes = await Promise.all(recovery.map(sha256Hex));
      // upsert (resets verified=false)
      await sb.from("mfa_enrollments").upsert({
        user_id: userId,
        secret_encrypted: secret, // TODO: app-layer encrypt with KMS in production
        recovery_codes_hash: recoveryHashes,
        verified: false,
      }, { onConflict: "user_id" });
      const email = ctx.email ?? userId;
      const uri = buildOtpauthUri(email, secret, "Bimaster");
      return json({ secret, otpauth_uri: uri, recovery_codes: recovery });
    }

    if (body.action === "verify") {
      if (!body.code || !/^\d{6}$/.test(body.code)) {
        return json({ error: "Código TOTP inválido" }, 400);
      }
      const { data: enrollment } = await sb.from("mfa_enrollments")
        .select("secret_encrypted").eq("user_id", userId).maybeSingle();
      if (!enrollment) return json({ error: "Sem enrollment ativo" }, 404);
      const ok = await verifyTotp(enrollment.secret_encrypted, body.code);
      if (!ok) {
        await sb.from("security_events").insert({
          event_type: "mfa.verify_fail", user_id: userId, severity: "warn",
        }).then(() => {}, () => {});
        return json({ error: "Código incorreto" }, 401);
      }
      await sb.from("mfa_enrollments")
        .update({ verified: true, verified_at: new Date().toISOString(), last_used_at: new Date().toISOString() })
        .eq("user_id", userId);
      return json({ ok: true });
    }

    if (body.action === "disable") {
      // Exige código TOTP válido pra desabilitar
      if (!body.code || !/^\d{6}$/.test(body.code)) {
        return json({ error: "Código TOTP necessário" }, 400);
      }
      const { data: enrollment } = await sb.from("mfa_enrollments")
        .select("secret_encrypted").eq("user_id", userId).maybeSingle();
      if (!enrollment) return json({ error: "Sem enrollment" }, 404);
      const ok = await verifyTotp(enrollment.secret_encrypted, body.code);
      if (!ok) return json({ error: "Código incorreto" }, 401);
      await sb.from("mfa_enrollments").delete().eq("user_id", userId);
      return json({ ok: true });
    }

    return json({ error: "Ação inválida" }, 400);
  },
));

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json" },
  });
}
