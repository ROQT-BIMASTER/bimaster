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

## HSTS Preload

The canonical HSTS header emitted by all three edge configs
(`public/_headers`, `vercel.json`, `cloudflare/worker.js`) is:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

This satisfies the [Chromium HSTS preload list](https://hstspreload.org/)
requirements (also honored by Firefox, Safari, Edge):

1. Valid HTTPS certificate on the apex (`bimaster.online`) and **all**
   subdomains.
2. Redirect HTTP → HTTPS on the apex (status `301`/`308`).
3. Serve HSTS on the **HTTPS apex response** with:
   - `max-age` ≥ `31536000` (1 year). We use `63072000` (2 years).
   - `includeSubDomains`
   - `preload`
4. All subdomains must also be HTTPS-only and must not weaken the policy
   (no shorter `max-age` on a subdomain — Cloudflare must not strip the
   header on `www.`, `api.`, `china.`, etc.).

### Enable on Cloudflare

If Cloudflare proxies the domain (recommended), enable HSTS in the
dashboard so it is asserted even on responses that bypass the Worker:

1. Cloudflare dashboard → select zone `bimaster.online`.
2. **SSL/TLS → Edge Certificates → HTTP Strict Transport Security (HSTS)**.
3. Click **Enable HSTS** and confirm. Set:
   - Max Age Header (max-age): **12 months** (or longer).
   - Apply HSTS policy to subdomains (includeSubDomains): **On**.
   - Preload: **On**.
   - No-Sniff Header: **On**.
4. Also enable **Always Use HTTPS** (SSL/TLS → Edge Certificates) so the
   apex returns a `301` to HTTPS for any cleartext request — required by
   the preload list.

The Cloudflare Worker (`cloudflare/worker.js`) re-asserts the same header
for completeness; the dashboard setting is the safety net for any
response that does not transit the Worker.

### Verify before submitting

Run all four checks and ensure each one passes:

```bash
# 1. Apex HTTPS returns the preload-eligible header
curl -sI https://bimaster.online/ | grep -i '^strict-transport-security'
# Expected: max-age=63072000; includeSubDomains; preload

# 2. Apex HTTP redirects to HTTPS (301/308)
curl -sI http://bimaster.online/ | head -1
# Expected: HTTP/1.1 301  (or 308)

# 3. www subdomain is HTTPS-only and also serves the header
curl -sI https://www.bimaster.online/ | grep -i '^strict-transport-security'

# 4. Any other live subdomain (e.g. china.bimaster.online)
curl -sI https://china.bimaster.online/ | grep -i '^strict-transport-security'
```

Then run the official preload eligibility check:

```
https://hstspreload.org/?domain=bimaster.online
```

Address every error and warning shown. The page must report:

> Status: Eligible for the HSTS preload list.

### Submit to the preload list

1. Open <https://hstspreload.org/>.
2. Enter `bimaster.online`, tick the three confirmation boxes.
3. Click **Submit**.
4. Inclusion in Chrome typically ships within 6–12 weeks; Firefox/Safari
   pull from the Chromium list on a similar cadence.

### Rollback caveat

Once preloaded, removing HSTS requires submitting a removal request and
waiting for the next browser release that drops the entry — this can take
**months**. Do not preload until every subdomain is permanently HTTPS-
capable. If a subdomain may need to serve plain HTTP in the future,
**do not** include `includeSubDomains` and **do not** preload.
