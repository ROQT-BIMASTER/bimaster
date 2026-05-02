// _shared/webhook-hmac.ts
// HMAC-SHA256 verification helpers for inbound webhooks (Pluggy, Phyllo, Meta/WhatsApp).
// Always operate on RAW request body bytes — never on a re-stringified parse.
// Uses constant-time comparison via timingSafeEqual.

import { timingSafeEqual } from "./timing-safe.ts";

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Meta / WhatsApp Cloud API:
 *   header: x-hub-signature-256
 *   format: "sha256=<hex>"
 */
export async function verifyMetaSignature(
  rawBody: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = "sha256=" + (await hmacSha256Hex(secret, rawBody));
  return timingSafeEqual(header, expected);
}

/**
 * Pluggy:
 *   header: x-signature (or x-pluggy-signature)
 *   format: hex digest of HMAC-SHA256(rawBody, secret)
 */
export async function verifyPluggySignature(
  rawBody: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header) return false;
  const expected = await hmacSha256Hex(secret, rawBody);
  // Pluggy may send raw hex or "sha256=<hex>"; normalize.
  const received = header.startsWith("sha256=") ? header.slice(7) : header;
  return timingSafeEqual(received.toLowerCase(), expected.toLowerCase());
}

/**
 * Phyllo:
 *   header: phyllo-signature (or x-phyllo-signature)
 *   format: hex digest of HMAC-SHA256(rawBody, secret)
 */
export async function verifyPhylloSignature(
  rawBody: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header) return false;
  const expected = await hmacSha256Hex(secret, rawBody);
  const received = header.startsWith("sha256=") ? header.slice(7) : header;
  return timingSafeEqual(received.toLowerCase(), expected.toLowerCase());
}

/**
 * Best-effort security event logger — never throws (avoid masking the original 401).
 */
export async function logWebhookSignatureFailure(
  supabase: any,
  source: string,
  reason: string,
  ip: string | null,
): Promise<void> {
  try {
    await supabase.from("security_events").insert({
      event_type: "webhook.signature_invalid",
      severity: "warn",
      metadata: { source, reason, ip },
    });
  } catch {
    // intentionally silent
  }
}
