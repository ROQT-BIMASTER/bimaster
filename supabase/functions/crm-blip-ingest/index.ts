// crm-blip-ingest — receptor de webhooks do Blip / WhatsApp Cloud
// Público (sem JWT). Valida HMAC contra crm_bots.webhook_secret e idempotência por id da mensagem.
// URL esperada: /functions/v1/crm-blip-ingest?bot_id=<uuid>
// Header esperado: x-bimaster-signature: sha256=<hex(hmac_sha256(body, secret))>
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

type IngestPayload = {
  // Formato Blip "Message" (envelope LIME)
  id?: string;
  from?: string;
  to?: string;
  type?: string;            // ex: text/plain, application/json, image/*
  content?: unknown;
  metadata?: Record<string, unknown>;
  storageDate?: string;
  // Alguns webhooks vêm em array
};

function hexFromBuffer(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return hexFromBuffer(sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function extractText(content: unknown): { tipo: string; texto: string | null; mime: string | null; url: string | null } {
  if (typeof content === "string") return { tipo: "text", texto: content, mime: null, url: null };
  if (content && typeof content === "object") {
    const c = content as Record<string, unknown>;
    if (typeof c.text === "string") return { tipo: "text", texto: c.text, mime: null, url: null };
    if (typeof c.uri === "string") {
      const mime = typeof c.type === "string" ? (c.type as string) : null;
      const tipo = mime?.startsWith("image/") ? "image"
        : mime?.startsWith("audio/") ? "audio"
        : mime?.startsWith("video/") ? "video"
        : "file";
      return { tipo, texto: typeof c.title === "string" ? c.title as string : null, mime, url: c.uri as string };
    }
  }
  try {
    return { tipo: "text", texto: JSON.stringify(content), mime: null, url: null };
  } catch {
    return { tipo: "text", texto: null, mime: null, url: null };
  }
}

function parseIdentity(s: string | undefined): { external: string; phone: string | null } {
  if (!s) return { external: "", phone: null };
  // Ex.: "5511999998888@wa.gw.msging.net/abc"
  const base = s.split("/")[0];
  const node = base.split("@")[0];
  const phone = /^\d{8,15}$/.test(node) ? node : null;
  return { external: base, phone };
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const botId = url.searchParams.get("bot_id");
  if (!botId) {
    return new Response(JSON.stringify({ error: "bot_id obrigatório" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Busca segredo HMAC e bot
  const { data: secret, error: secErr } = await sb.rpc("crm_bot_get_webhook_secret", { p_bot_id: botId });
  if (secErr || !secret) {
    return new Response(JSON.stringify({ error: "bot inválido" }), {
      status: 404, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Valida HMAC (suporta "sha256=<hex>" ou apenas hex)
  const sigHeader = req.headers.get("x-bimaster-signature") ?? req.headers.get("x-hub-signature-256") ?? "";
  const sigHex = sigHeader.replace(/^sha256=/i, "").trim().toLowerCase();
  const expected = await hmacSha256Hex(secret as string, rawBody);
  const hmacOk = sigHex.length > 0 && timingSafeEqual(sigHex, expected);

  // Idempotência: tenta extrair id do payload
  let payload: IngestPayload | IngestPayload[] = [];
  try { payload = JSON.parse(rawBody); } catch { /* ignore */ }
  const items = Array.isArray(payload) ? payload : [payload];
  const idemKey = items[0]?.id ?? `${Date.now()}-${crypto.randomUUID()}`;

  // Loga (mesmo se HMAC falhar — registra para auditoria)
  const { error: logErr } = await sb.from("crm_webhooks_in_log").insert({
    empresa_id: 0, // placeholder; corrigido abaixo via trigger? Vamos buscar do bot
    bot_id: botId,
    raw: payload,
    headers: Object.fromEntries(req.headers),
    hmac_ok: hmacOk,
    idempotency_key: idemKey,
  });
  // Se duplicado pelo unique idempotency_key, log de duplicata
  const duplicate = logErr?.message?.includes("uq_crm_whin_idem") ?? false;

  if (!hmacOk) {
    return new Response(JSON.stringify({ error: "assinatura inválida", expected_alg: "sha256" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (duplicate) {
    return new Response(JSON.stringify({ ok: true, duplicate: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Processa cada mensagem
  const results: Array<{ id?: string; ok: boolean; error?: string }> = [];
  for (const msg of items) {
    try {
      const fromId = parseIdentity(msg.from);
      const toId = parseIdentity(msg.to);
      const direction: "in" | "out" = msg.from ? "in" : "out";
      const externalThread = direction === "in" ? fromId.external : toId.external;
      const phone = direction === "in" ? fromId.phone : toId.phone;
      const parsed = extractText(msg.content);
      const meta = (msg.metadata ?? {}) as Record<string, unknown>;
      const name = typeof meta["#messageEmitter"] === "string"
        ? meta["#messageEmitter"] as string
        : typeof meta["#wa.contactName"] === "string" ? meta["#wa.contactName"] as string : null;

      const { error: ingErr } = await sb.rpc("crm_ingest_message", {
        p_bot_id: botId,
        p_external_thread: externalThread,
        p_blip_msg_id: msg.id ?? null,
        p_direction: direction,
        p_tipo: parsed.tipo as "text" | "image" | "audio" | "video" | "file",
        p_conteudo: parsed.texto,
        p_midia_url: parsed.url,
        p_midia_mime: parsed.mime,
        p_contato_nome: name,
        p_contato_telefone: phone,
        p_contato_email: null,
        p_criada_em: msg.storageDate ?? new Date().toISOString(),
        p_metadata: meta,
      });
      results.push({ id: msg.id, ok: !ingErr, error: ingErr?.message });
    } catch (e) {
      results.push({ id: msg.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Atualiza ultimo_sync_at
  await sb.rpc("crm_bot_touch_sync", { p_bot_id: botId, p_erro: null });

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
