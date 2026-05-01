# Edge HTTP Security Headers

This document describes how production HTTP security headers (CSP, HSTS,
clickjacking, COOP/CORP, Permissions-Policy, etc.) are enforced for the
deployed application.

## Why HTTP headers (not `<meta>` tags)

Several critical headers are **only honored** when delivered as real HTTP
response headers — they are silently ignored as `<meta http-equiv>`:

| Header                          | Meta tag works? |
| ------------------------------- | --------------- |
| `Strict-Transport-Security`     | No              |
| `X-Frame-Options`               | No              |
| `Content-Security-Policy: frame-ancestors` | No   |
| `Cross-Origin-Opener-Policy`    | No              |
| `Cross-Origin-Resource-Policy`  | No              |
| `Permissions-Policy`            | Partial         |
| `Referrer-Policy`               | Yes (limited)   |

The repository previously relied on `<meta>` tags in `index.html` for
defense-in-depth. Those remain as a fallback, but production protection
must come from real headers.

## Source of truth

The canonical header set lives in **`public/_headers`** (Netlify format).
Three mirrors keep parity for other hosts:

| File | Used by |
| ---- | ------- |
| `public/_headers` | Netlify, Cloudflare Pages, any host that reads `_headers` |
| `vercel.json` | Vercel |
| `netlify.toml` | Netlify (build/redirect; headers come from `_headers`) |
| `cloudflare/worker.js` + `cloudflare/wrangler.toml` | Cloudflare Worker fronting any origin (incl. Lovable hosting) |

When you change one, **update all four**.

## Cloudflare Worker (recommended for the Lovable origin)

Lovable's managed hosting may not honor `public/_headers`. To guarantee
the headers in production we deploy a Cloudflare Worker that proxies
the origin and rewrites response headers:

```bash
npx wrangler deploy --config cloudflare/wrangler.toml
```

Then in the Cloudflare dashboard, bind the Worker to a route on your
custom domain (e.g. `bimaster.online/*`). DNS for the apex/www must be
proxied (orange cloud) through Cloudflare for the route to fire.

The Worker:

1. Forwards every request to `ORIGIN` (configured in `wrangler.toml`).
2. Strips any conflicting upstream headers (CSP, XFO, HSTS, etc.).
3. Injects the canonical security header set.
4. Applies long-cache for `/assets/*` and no-cache for `/sw.js`.

## CSP allow-list

`connect-src` enumerates every external host the SPA legitimately calls:

- Supabase REST + Realtime (`aokkyrgaqjarhlywhjju.supabase.co`, `*.supabase.co`)
- OpenAI, ElevenLabs
- Mapbox (REST + tiles + events)
- Google APIs (Maps, Places, Storage)
- Asana
- Stripe
- Lovable preview/API (`*.lovable.dev`, `*.lovable.app`, `lovable-api.com`)

Add new hosts here when adding new integrations. Missing hosts will fail
silently in the browser with a CSP violation in the console.

## Verifying in production

Run the end-to-end clickjacking suite (also wired into CI):

```bash
TARGET_URL=https://bimaster.online \
ROUTES="/,/privacidade,/termos,/contato" \
EXTERNAL_ORIGINS="https://attacker.example" \
ALLOWED_ORIGINS="https://lovable.dev" \
bash scripts/security/e2e-clickjacking.sh
```

Quick manual check:

```bash
curl -sI https://bimaster.online/ | grep -iE 'strict-transport|frame|content-security|referrer|permissions|cross-origin'
```

External validators:

- <https://securityheaders.com/>
- <https://csp-evaluator.withgoogle.com/>
- <https://hstspreload.org/>
