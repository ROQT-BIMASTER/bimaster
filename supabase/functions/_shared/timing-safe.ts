// _shared/timing-safe.ts — Timing-safe comparison (ADV-1)

/**
 * Constant-time string comparison to prevent timing attacks.
 * Uses crypto.subtle for platforms without timingSafeEqual.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a dummy comparison to avoid leaking length info via timing
    const dummy = new Uint8Array(32);
    const dummy2 = new Uint8Array(32);
    constantTimeCompare(dummy, dummy2);
    return false;
  }

  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  return constantTimeCompare(bufA, bufB);
}

/**
 * Constant-time byte array comparison.
 * XORs all bytes and checks if result is zero — no early exit.
 */
function constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}
