// webhook-dispatcher — Processes webhook event queue and sends to ERP via REST
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";
import { validateAnyAuth, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

const MAX_EVENTS_PER_RUN = 50;

function json(body: unknown, status: number, req: Request) {
  const cors = getCorsHeaders(req);
  const headers = withSecurityHeaders(
    { ...cors, "Content-Type": "application/json" },
    status === 401 || status === 403
  );
  return new Response(JSON.stringify(body), { status, headers });
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return "sha256=" + Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/webhook-dispatcher\/?/, "/").replace(/\/+$/, "") || "/";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Health check
  if (req.method === "GET" && path === "/status") {
    return json({ status: "ok", service: "webhook-dispatcher" }, 200, req);
  }

  // Auth for all other routes
  try {
    await validateAnyAuth(req);
    await checkRateLimit({ prefix: "webhook-dispatcher", limit: 30, req });
  } catch (e) {
    if (e instanceof RateLimitError) return json({ error: e.message }, 429, req);
    const status = e instanceof AuthError ? e.status : 401;
    return json({ error: (e as Error).message }, status, req);
  }

  // ── GET /stats ─────────────────────────────────────────────
  if (req.method === "GET" && path === "/stats") {
    const { data: pending } = await supabase.from("webhook_event_queue").select("id", { count: "exact", head: true }).eq("status", "pending");
    const { data: failed } = await supabase.from("webhook_event_queue").select("id", { count: "exact", head: true }).eq("status", "failed");
    const { data: sent } = await supabase.from("webhook_event_queue").select("id", { count: "exact", head: true }).eq("status", "sent");
    const { data: dead } = await supabase.from("webhook_event_queue").select("id", { count: "exact", head: true }).eq("status", "dead");
    const { count: subs } = await supabase.from("webhook_subscriptions").select("id", { count: "exact", head: true }).eq("ativo", true);

    return json({
      subscriptions_ativas: subs || 0,
      fila: { pending: 0, failed: 0, sent: 0, dead: 0 },
    }, 200, req);
  }

  // ── POST /process ──────────────────────────────────────────
  if (req.method === "POST" && path === "/process") {
    const { data: events, error } = await supabase
      .from("webhook_event_queue")
      .select("*, webhook_subscriptions!inner(url, secret, headers_customizados)")
      .in("status", ["pending", "failed"])
      .lte("proxima_tentativa", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(MAX_EVENTS_PER_RUN);

    if (error) return json({ error: error.message }, 500, req);
    if (!events || events.length === 0) {
      return json({ processed: 0, message: "Nenhum evento pendente" }, 200, req);
    }

    let sent = 0, failed = 0;

    for (const event of events) {
      const sub = (event as any).webhook_subscriptions;
      const payloadStr = JSON.stringify(event.payload);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = await signPayload(payloadStr, sub.secret);
      const startMs = Date.now();

      try {
        const customHeaders = sub.headers_customizados || {};
        const response = await fetch(sub.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Event": event.evento,
            "X-Webhook-Signature": signature,
            "X-Webhook-Timestamp": timestamp,
            "X-Webhook-ID": event.id,
            ...customHeaders,
          },
          body: payloadStr,
          signal: AbortSignal.timeout(30000),
        });

        const responseBody = await response.text();
        const durationMs = Date.now() - startMs;

        // Log delivery
        await supabase.from("webhook_delivery_log").insert({
          event_id: event.id,
          subscription_id: event.subscription_id,
          http_status: response.status,
          response_body: responseBody.substring(0, 2000),
          duration_ms: durationMs,
        });

        if (response.ok) {
          await supabase.from("webhook_event_queue")
            .update({ status: "sent", sent_at: new Date().toISOString(), http_status: response.status })
            .eq("id", event.id);
          sent++;
        } else {
          const tentativas = (event.tentativas || 0) + 1;
          const newStatus = tentativas >= (event.max_tentativas || 3) ? "dead" : "failed";
          const backoffSec = Math.pow(2, tentativas) * 30;
          const proxima = new Date(Date.now() + backoffSec * 1000).toISOString();

          await supabase.from("webhook_event_queue")
            .update({
              status: newStatus,
              tentativas,
              proxima_tentativa: proxima,
              ultimo_erro: `HTTP ${response.status}: ${responseBody.substring(0, 500)}`,
              http_status: response.status,
            })
            .eq("id", event.id);
          failed++;
        }
      } catch (err) {
        const durationMs = Date.now() - startMs;
        const errorMsg = err instanceof Error ? err.message : String(err);
        const tentativas = (event.tentativas || 0) + 1;
        const newStatus = tentativas >= (event.max_tentativas || 3) ? "dead" : "failed";
        const backoffSec = Math.pow(2, tentativas) * 30;
        const proxima = new Date(Date.now() + backoffSec * 1000).toISOString();

        await supabase.from("webhook_delivery_log").insert({
          event_id: event.id,
          subscription_id: event.subscription_id,
          duration_ms: durationMs,
          erro: errorMsg,
        });

        await supabase.from("webhook_event_queue")
          .update({
            status: newStatus,
            tentativas,
            proxima_tentativa: proxima,
            ultimo_erro: errorMsg,
          })
          .eq("id", event.id);
        failed++;
      }
    }

    return json({ processed: events.length, sent, failed }, 200, req);
  }

  // ── POST /retry-dead ───────────────────────────────────────
  if (req.method === "POST" && path === "/retry-dead") {
    const { count, error } = await supabase
      .from("webhook_event_queue")
      .update({
        status: "pending",
        tentativas: 0,
        proxima_tentativa: new Date().toISOString(),
        ultimo_erro: null,
      })
      .eq("status", "dead")
      .select("id", { count: "exact", head: true });

    if (error) return json({ error: error.message }, 500, req);
    return json({ requeued: count || 0 }, 200, req);
  }

  return json({ error: "Rota não encontrada" }, 404, req);
});
