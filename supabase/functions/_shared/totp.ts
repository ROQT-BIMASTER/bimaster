// _shared/totp.ts — TOTP (RFC 6238) implementation in Deno, no external deps
// Compatible with Google Authenticator, Authy, 1Password.

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateBase32Secret(bytes = 20): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base32Encode(buf);
}

export function base32Encode(data: Uint8Array): string {
  let bits = 0, value = 0, out = "";
  for (const b of data) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str: string): Uint8Array {
  const clean = str.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

async function hmacSha1(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key, { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, msg);
  return new Uint8Array(sig);
}

export async function totpCode(secretBase32: string, time = Date.now(), step = 30, digits = 6): Promise<string> {
  const counter = Math.floor(time / 1000 / step);
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(4, counter, false);
  const hmac = await hmacSha1(base32Decode(secretBase32), new Uint8Array(buf));
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  const code = (bin % 10 ** digits).toString().padStart(digits, "0");
  return code;
}

/** Verifies code with ±1 step tolerance (clock drift). */
export async function verifyTotp(secretBase32: string, code: string): Promise<boolean> {
  const now = Date.now();
  for (const drift of [-1, 0, 1]) {
    const expected = await totpCode(secretBase32, now + drift * 30_000);
    if (timingSafeEqual(expected, code)) return true;
  }
  return false;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function buildOtpauthUri(label: string, secretBase32: string, issuer = "Bimaster"): string {
  const enc = (s: string) => encodeURIComponent(s);
  return `otpauth://totp/${enc(issuer)}:${enc(label)}?secret=${secretBase32}&issuer=${enc(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const buf = new Uint8Array(5);
    crypto.getRandomValues(buf);
    codes.push(Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase());
  }
  return codes;
}
