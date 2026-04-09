// _shared/security-headers.ts — Enterprise security headers (ADV-2)

/**
 * Security headers to include in all Edge Function responses.
 * These complement CORS headers and provide defense-in-depth.
 */
export function getSecurityHeaders(sensitive = false): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' *.supabase.co; object-src 'none'; frame-ancestors 'self'",
  };

  if (sensitive) {
    headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private";
    headers["Pragma"] = "no-cache";
  }

  return headers;
}

/**
 * Merge security headers into existing headers object.
 */
export function withSecurityHeaders(
  existingHeaders: Record<string, string>,
  sensitive = false
): Record<string, string> {
  return {
    ...existingHeaders,
    ...getSecurityHeaders(sensitive),
  };
}
