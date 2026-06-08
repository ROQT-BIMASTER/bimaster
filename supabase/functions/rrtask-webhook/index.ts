// Edge Function: rrtask-webhook
//
// Recebe eventos do Notion (RR-Tasks da agência) e atualiza imediatamente a
// tabela `briefings` com o novo status, sem depender do poll de 5 minutos.
//
// Fluxo:
//
// 1) Notion → POST aqui com:
//    a) Handshake de verificação: body contém `verification_token` na primeira
//       configuração. Persistimos o token no vault (`rrtask_webhook_secret`)
//       via RPC `_set_rrtask_webhook_secret` e devolvemos {challenge}.
//    b) Eventos: body com `entity.id` (page id) e `type` (ex.: page.properties_updated).
//       Validamos a assinatura `X-Notion-Signature: sha256=hex(HMAC-SHA256(body, token))`,
//       resolvemos o briefing pelo `rrtask_page_id` e aplicamos a mesma rotina
//       usada pelo poller (`_shared/rrtask-apply-page.ts`).
//
// Auth: público (verify_jwt = false). Segurança = HMAC + rate limit.
import { createClient } from "npm:@supabase/supabase-js@2";
import { timingSafeEqual } from "https://deno.land/std@0.224.0/crypto/timing_safe_equal.ts";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { applyRrtaskPage, type BriefingMirrorRow } from "../_shared/rrtask-apply-page.ts";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

async function hmacSha256Hex(key: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function extractPageId(evt: any): string | null {
  // Notion v1 webhooks use `entity.id`. Some events also surface `data.parent.id`.
  return evt?.entity?.id ?? evt?.data?.id ?? evt?.page?.id ?? null;
}

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 120, rateLimitPrefix: "rrtask-webhook" },
  async (req) => {
    const corsHeaders = getCorsHeaders(req);
    const J = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    if (req.method !== "POST") return J({ ok: false, error: "method_not_allowed" }, 405);

    const rawBody = await req.text();
    let payload: any = null;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return J({ ok: false, error: "invalid_json" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Handshake de verificação do Notion.
    if (payload?.verification_token && typeof payload.verification_token === "string") {
      const { error: setErr } = await admin.rpc("_set_rrtask_webhook_secret", {
        _value: payload.verification_token,
      });
      if (setErr) {
        console.error("[rrtask-webhook] failed to persist verification_token", setErr);
        return J({ ok: false, error: "vault_write_failed" }, 500);
      }
      // Echo o token para a Notion confirmar a posse.
      return J({ challenge: payload.verification_token });
    }

    // 2) Eventos normais — exigem assinatura.
    const sigHeader = req.headers.get("x-notion-signature")
      ?? req.headers.get("notion-signature")
      ?? "";
    if (!sigHeader) return J({ ok: false, error: "missing_signature" }, 401);

    const { data: secret, error: vaultErr } = await admin.rpc("_get_rrtask_webhook_secret");
    if (vaultErr || !secret) {
      return J({ ok: false, error: "secret_unavailable" }, 503);
    }

    const expectedHex = await hmacSha256Hex(secret as string, rawBody);
    const providedHex = sigHeader.replace(/^sha256=/, "").trim();
    if (providedHex.length !== expectedHex.length) {
      return J({ ok: false, error: "bad_signature" }, 401);
    }
    const a = hexToBytes(providedHex);
    const b = hexToBytes(expectedHex);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return J({ ok: false, error: "bad_signature" }, 401);
    }

    // 3) Resolver briefing pelo page id e aplicar.
    const pageId = extractPageId(payload);
    if (!pageId) return J({ ok: true, skipped: "no_page_id" });

    const rrToken = Deno.env.get("HUGGS_RR_TOKEN");
    if (!rrToken) return J({ ok: false, error: "rr_token_missing" }, 412);

    const { data: rows, error: rowsErr } = await admin
      .from("briefings")
      .select("id, rrtask_page_id, rrtask_last_edited_time, rrtask_aprovacao, rrtask_data_aprovacao")
      .eq("rrtask_page_id", pageId)
      .limit(1);

    if (rowsErr) return J({ ok: false, error: rowsErr.message }, 500);
    if (!rows || rows.length === 0) {
      return J({ ok: true, skipped: "unknown_page", page_id: pageId });
    }

    const outcome = await applyRrtaskPage({
      sb: admin,
      rrToken,
      briefing: rows[0] as BriefingMirrorRow,
      source: "webhook",
    });

    return J({ ok: true, page_id: pageId, event_type: payload?.type ?? null, outcome });
  },
));
