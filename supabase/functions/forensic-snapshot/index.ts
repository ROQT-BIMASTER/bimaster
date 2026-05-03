// forensic-snapshot — Snapshot forense de um usuário (admin + step-up)
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(secureHandler({
  auth: "jwt",
  rateLimit: 10,
  rateLimitPrefix: "forensic-snapshot",
  requireStepUp: "user.management",
  mfaFailMode: "closed",
}, async (req, ctx) => {
  const cors = getCorsHeaders(req);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: isAdmin } = await sb.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin only" }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const targetUser = url.searchParams.get("user_id");
  const hours = parseInt(url.searchParams.get("hours") ?? "24", 10);

  if (!targetUser) {
    return new Response(JSON.stringify({ error: "user_id required" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await sb.rpc("incident_snapshot", { _user_id: targetUser, _hours: hours });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Hash do snapshot para integridade
  const snapshot = { ...data, audit_user: ctx.userId, audit_at: new Date().toISOString() };
  const enc = new TextEncoder().encode(JSON.stringify(snapshot));
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");

  return new Response(JSON.stringify({ snapshot, integrity_hash: hash }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
}));
