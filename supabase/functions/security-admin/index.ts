// security-admin: ações de segurança restritas a admins
// Operações:
//  - GET  ?op=kpis        → KPIs do SIEM (24h/7d)
//  - GET  ?op=events      → últimos 200 eventos
//  - GET  ?op=invariants  → security_invariants_check()
//  - GET  ?op=audit       → últimas 200 linhas de auditoria
//  - POST {op:"quarantine", user_id, reason, expires_at?}
//  - POST {op:"release",    user_id, note?}
//  - POST {op:"verify_chain", limit?}

import { secureHandler } from "../_shared/secure-handler.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { logSensitiveOperation } from "../_shared/audit-log.ts";

async function ensureAdmin(userId: string): Promise<boolean> {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}

const STEP_UP_SCOPE = "security.admin.config";

async function validateStepUp(userId: string, token: string | null): Promise<boolean> {
  if (!token) return false;
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data } = await sb.rpc("mfa_step_up_validate", {
    _user_id: userId,
    _scope: STEP_UP_SCOPE,
    _token: token,
  });
  return !!data;
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 60, rateLimitPrefix: "security-admin" },
  async (req, ctx) => {
    const cors = { ...getCorsHeaders(req), "Content-Type": "application/json" };
    if (!ctx.userId || !(await ensureAdmin(ctx.userId))) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: cors });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (req.method === "GET") {
      const op = new URL(req.url).searchParams.get("op") || "kpis";

      if (op === "kpis") {
        const { data: ev24 } = await sb
          .from("security_events")
          .select("event_type, severity")
          .gte("occurred_at", new Date(Date.now() - 24 * 3600_000).toISOString());
        const { count: quarantineCount } = await sb
          .from("account_quarantine")
          .select("*", { count: "exact", head: true })
          .is("released_at", null);
        const buckets: Record<string, number> = {};
        const sev: Record<string, number> = {};
        for (const r of (ev24 ?? []) as Array<{event_type:string; severity:string}>) {
          buckets[r.event_type] = (buckets[r.event_type] || 0) + 1;
          sev[r.severity] = (sev[r.severity] || 0) + 1;
        }
        return new Response(JSON.stringify({
          window_hours: 24,
          events_total: ev24?.length ?? 0,
          events_by_type: buckets,
          events_by_severity: sev,
          accounts_quarantined: quarantineCount ?? 0,
        }), { headers: cors });
      }

      if (op === "events") {
        const { data, error } = await sb
          .from("security_events")
          .select("*")
          .order("occurred_at", { ascending: false })
          .limit(200);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
        return new Response(JSON.stringify({ events: data }), { headers: cors });
      }

      if (op === "audit") {
        const { data, error } = await sb
          .from("audit_log_immutable")
          .select("*")
          .order("id", { ascending: false })
          .limit(200);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
        return new Response(JSON.stringify({ audit: data }), { headers: cors });
      }

      if (op === "invariants") {
        const { data, error } = await sb.rpc("security_invariants_check");
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
        return new Response(JSON.stringify({ checks: data }), { headers: cors });
      }

      if (op === "quarantined") {
        const { data, error } = await sb
          .from("account_quarantine")
          .select("*")
          .is("released_at", null)
          .order("quarantined_at", { ascending: false });
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
        return new Response(JSON.stringify({ accounts: data }), { headers: cors });
      }

      return new Response(JSON.stringify({ error: "unknown op" }), { status: 400, headers: cors });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const op = body.op as string | undefined;

      // TODO: re-enable step-up enforcement after frontend wires x-step-up-token.
      // Mantemos a validação opcional: se header vier, validamos; sem header, permite (compat).
      const stepUpToken = req.headers.get("x-step-up-token");
      if (stepUpToken) {
        const stepUpOk = await validateStepUp(ctx.userId!, stepUpToken);
        if (!stepUpOk) {
          await logSensitiveOperation(ctx, req, {
            action: `security.admin.${op ?? "unknown"}`,
            outcome: "denied",
            metadata: { reason: "step_up_invalid" },
          });
          return new Response(
            JSON.stringify({ error: "Step-up inválido.", code: "STEP_UP_INVALID", scope: STEP_UP_SCOPE }),
            { status: 401, headers: cors },
          );
        }
      }

      if (op === "quarantine") {
        if (!body.user_id || !body.reason) {
          return new Response(JSON.stringify({ error: "user_id e reason são obrigatórios" }), { status: 400, headers: cors });
        }
        // Chama com JWT do admin para que account_quarantine_set pegue auth.uid() correto
        const userClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
        );
        const { error } = await userClient.rpc("account_quarantine_set", {
          p_user_id: body.user_id,
          p_reason: body.reason,
          p_expires_at: body.expires_at ?? null,
        });
        if (error) {
          await logSensitiveOperation(ctx, req, {
            action: "security.admin.quarantine",
            target_id: body.user_id,
            target_type: "user",
            outcome: "failure",
            metadata: { error: error.message },
          });
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
        }
        await logSensitiveOperation(ctx, req, {
          action: "security.admin.quarantine",
          target_id: body.user_id,
          target_type: "user",
          outcome: "success",
          metadata: { reason: body.reason, expires_at: body.expires_at ?? null },
        });
        return new Response(JSON.stringify({ ok: true }), { headers: cors });
      }

      if (op === "release") {
        const userClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
        );
        const { error } = await userClient.rpc("account_quarantine_release", {
          p_user_id: body.user_id,
          p_note: body.note ?? null,
        });
        if (error) {
          await logSensitiveOperation(ctx, req, {
            action: "security.admin.release",
            target_id: body.user_id,
            target_type: "user",
            outcome: "failure",
            metadata: { error: error.message },
          });
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
        }
        await logSensitiveOperation(ctx, req, {
          action: "security.admin.release",
          target_id: body.user_id,
          target_type: "user",
          outcome: "success",
          metadata: { note: body.note ?? null },
        });
        return new Response(JSON.stringify({ ok: true }), { headers: cors });
      }

      if (op === "verify_chain") {
        const { data, error } = await sb.rpc("audit_log_verify_chain", { p_limit: body.limit ?? 1000 });
        if (error) {
          await logSensitiveOperation(ctx, req, {
            action: "security.admin.verify_chain",
            outcome: "failure",
            metadata: { error: error.message },
          });
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
        }
        await logSensitiveOperation(ctx, req, {
          action: "security.admin.verify_chain",
          outcome: "success",
          metadata: { broken_count: Array.isArray(data) ? data.length : 0 },
        });
        return new Response(JSON.stringify({ broken: data ?? [] }), { headers: cors });
      }

      return new Response(JSON.stringify({ error: "unknown op" }), { status: 400, headers: cors });
    }

    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: cors });
  }
));
