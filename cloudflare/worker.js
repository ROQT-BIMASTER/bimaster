/**
 * Cloudflare Worker — Edge HTTP security headers
 * ============================================================================
 * Deploys in front of the Lovable hosting (or any origin) and rewrites
 * response headers to enforce CSP / HSTS / clickjacking defenses at the edge.
 *
 * This is the production-grade equivalent of public/_headers for hosts where
 * static-host header injection is not available (e.g. when Lovable hosting
 * does not honor _headers). Mirrors public/_headers exactly.
 *
 * Deploy with cloudflare/wrangler.toml:
 *     npx wrangler deploy
 *
 * Runtime contract:
 *   - Forwards every request unchanged to ORIGIN.
 *   - Removes any conflicting headers set upstream.
 *   - Injects the canonical security header set.
 *   - Long-caches /assets/* (hashed Vite output), no-cache for /sw.js.
 */

const ORIGIN = "https://bimaster.lovable.app"; // override per-environment in wrangler.toml vars

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "upgrade-insecure-requests",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://storage.googleapis.com https://cdn.gpteng.co https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "child-src 'self' blob:",
  "frame-src 'self' https://challenges.cloudflare.com https://js.stripe.com https://hooks.stripe.com",
  "connect-src 'self' https://aokkyrgaqjarhlywhjju.supabase.co wss://aokkyrgaqjarhlywhjju.supabase.co https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.elevenlabs.io https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com https://maps.googleapis.com https://places.googleapis.com https://www.googleapis.com https://storage.googleapis.com https://app.asana.com https://api.stripe.com https://lovable-api.com https://*.lovable.dev https://*.lovable.app https://*.phyllo.com https://*.shipsgo.com https://api.pluggy.ai",
].join("; ");

const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), interest-cohort=(), browsing-topics=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Cross-Origin-Resource-Policy": "same-site",
  "X-Permitted-Cross-Domain-Policies": "none",
  "X-DNS-Prefetch-Control": "off",
  "Origin-Agent-Cluster": "?1",
  "Content-Security-Policy": CSP,
};

// Headers we strip from upstream before re-applying our canonical set.
const STRIP = [
  "content-security-policy",
  "content-security-policy-report-only",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "strict-transport-security",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "x-permitted-cross-domain-policies",
  "x-xss-protection", // deprecated; remove if upstream sets it
  "server",
  "x-powered-by",
];

export default {
  async fetch(request, env) {
    const origin = (env && env.ORIGIN) || ORIGIN;
    const url = new URL(request.url);
    const upstreamUrl = new URL(url.pathname + url.search, origin);

    const upstream = await fetch(upstreamUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    });

    const headers = new Headers(upstream.headers);
    for (const h of STRIP) headers.delete(h);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);

    // Asset caching policy
    if (url.pathname.startsWith("/assets/")) {
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } else if (url.pathname === "/sw.js") {
      headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
      headers.set("Service-Worker-Allowed", "/");
    } else if (url.pathname === "/index.html" || url.pathname === "/") {
      headers.set("Cache-Control", "no-cache");
    }

    headers.set("Server", "edge");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  },
};
