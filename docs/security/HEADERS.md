# Security Headers — bimaster.online

Documento canônico das políticas HTTP de segurança aplicadas em produção.

## Hosting real

`bimaster.online`, `www.bimaster.online` e `china.bimaster.online` são servidos
pela plataforma Lovable, que está atrás do Cloudflare gerenciado pela própria
Lovable. **Esse edge não honra `public/_headers` (estilo Netlify/Cloudflare
Pages) nem `vercel.json`.**

Para que os headers cheguem ao navegador na zona `bimaster.online`, mantemos um
Cloudflare Worker próprio em `cloudflare/worker.js`, deployado em uma zona
Cloudflare separada controlada por nós. O deploy é manual (ver runbook em
[`docs/SECURITY-HEADERS-DEPLOY.md`](../SECURITY-HEADERS-DEPLOY.md)).

| Arquivo | Aplicado em produção? | Motivo de manter |
|---|---|---|
| `cloudflare/worker.js` | **Sim** (após `wrangler deploy`) | Fonte de verdade real |
| `public/_headers` | Não (Lovable hosting ignora) | Paridade defensiva caso migremos para Cloudflare Pages/Netlify |
| `vercel.json` | Não (não estamos em Vercel) | Paridade defensiva caso migremos para Vercel |

> **Regra**: ao adicionar uma origem nova, atualize os **três arquivos** e
> redeploye o worker. Validar com `bash scripts/security/e2e-clickjacking.sh`.

## Headers aplicados

| Header | Valor |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), interest-cohort=(), browsing-topics=()` |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` |
| `Cross-Origin-Resource-Policy` | `same-site` |
| `X-Permitted-Cross-Domain-Policies` | `none` |
| `X-DNS-Prefetch-Control` | `off` |
| `Origin-Agent-Cluster` | `?1` |
| `Content-Security-Policy` | ver abaixo |

`X-Frame-Options: DENY` + `frame-ancestors 'none'` bloqueiam qualquer iframe
externo (clickjacking). Não relaxar sem justificativa de produto documentada.

## CSP — origens permitidas por integração

| Diretiva | Origens | Por quê |
|---|---|---|
| `default-src` | `'self'` | Padrão fechado |
| `script-src` | `'self' 'unsafe-inline' 'unsafe-eval' storage.googleapis.com cdn.gpteng.co challenges.cloudflare.com` | App Vite + Lovable runtime + Cloudflare Turnstile. `unsafe-inline`/`unsafe-eval` exigidos pelo bundle Vite/SWC e dependências (jspdf, pdfjs-dist) |
| `style-src` | `'self' 'unsafe-inline' fonts.googleapis.com` | Tailwind inline + Google Fonts CSS |
| `font-src` | `'self' data: fonts.gstatic.com` | Google Fonts WOFF2 + ícones embutidos base64 |
| `img-src` | `'self' data: blob: https:` | Avatares, uploads, mapas, OG images de terceiros |
| `media-src` | `'self' blob: https:` | Áudio ElevenLabs, vídeos do AI Creative Studio |
| `worker-src` | `'self' blob:` | Service worker PWA + workers de Mapbox |
| `frame-src` | `'self' challenges.cloudflare.com js.stripe.com hooks.stripe.com` | Turnstile + Stripe Checkout/Elements |
| `frame-ancestors` | `'none'` | Anti-clickjacking estrito |
| `connect-src` | ver tabela abaixo | XHR/fetch/WebSocket |
| `object-src` | `'none'` | Bloqueia plugins legados |
| `base-uri` | `'self'` | Anti base-tag injection |
| `form-action` | `'self'` | Anti form hijacking |

### `connect-src` detalhado

| Origem | Integração |
|---|---|
| `'self'` | App próprio |
| `https://aokkyrgaqjarhlywhjju.supabase.co` + `wss://...` | Lovable Cloud (banco e realtime do projeto) |
| `https://*.supabase.co` + `wss://*.supabase.co` | Lovable Cloud (storage, auth, edge functions cross-region) |
| `https://api.openai.com` | Sofia / Document Auditor (chamadas diretas só em fluxos legados; preferir AI Gateway via edge) |
| `https://api.elevenlabs.io` | Voz da Sofia |
| `https://api.mapbox.com`, `https://*.tiles.mapbox.com`, `https://events.mapbox.com` | Mapbox GL (Trade, China–Brasil) |
| `https://maps.googleapis.com`, `https://places.googleapis.com`, `https://www.googleapis.com` | Google Maps + Places (PDV onboarding) |
| `https://storage.googleapis.com` | Assets do Lovable |
| `https://app.asana.com` | Sincronização Asana ↔ Projetos |
| `https://api.stripe.com` | Pagamentos |
| `https://lovable-api.com`, `https://*.lovable.dev`, `https://*.lovable.app` | Plataforma Lovable |
| `https://*.phyllo.com` | Social Networks Hub (creator data) |
| `https://*.shipsgo.com` | Control Tower de transporte internacional |
| `https://api.pluggy.ai` | Open Finance / extratos bancários |

## Como validar

### Local (sem deploy)

```bash
bash scripts/security/e2e-clickjacking.sh
```

Enquanto o worker não estiver deployado, o teste contra `bimaster.online`
falhará 4/7 (esperado). O conteúdo do worker no repo pode ser inspecionado
diretamente em `cloudflare/worker.js`.

### Após `npx wrangler deploy`

```bash
curl -sI https://bimaster.online/ | grep -iE "x-frame|content-security|strict-transport"
bash scripts/security/e2e-clickjacking.sh
```

Esperado:
- `X-Frame-Options: DENY`
- `Content-Security-Policy: default-src 'self'; ...`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- E2E: 7/7 verde

### Em DevTools de produção

Abrir `https://bimaster.online`, aba Network, request do documento HTML, ver
Response Headers. Confirmar a presença de todos os headers da tabela acima.

## Como adicionar uma origem nova

1. Editar `cloudflare/worker.js` (linha do `connect-src` / `script-src` etc.)
2. Replicar em `public/_headers` e `vercel.json` (paridade)
3. Registrar a origem na tabela acima com a integração correspondente
4. Rodar `cd cloudflare && npx wrangler deploy`
5. Validar com `bash scripts/security/e2e-clickjacking.sh` e DevTools

## Como NÃO testar

- Não duplicar `X-Frame-Options` ou `frame-ancestors` em `<meta>` no
  `index.html` — navegadores ignoram essas diretivas em meta tags.
- Não relaxar `frame-ancestors` para `'self'` sem necessidade real (quebra a
  proteção contra clickjacking de subdomínios atacantes).
- Não adicionar `'unsafe-inline'` em `script-src` para resolver erros de CSP
  sem entender a origem real do script — quase sempre é melhor whitelistar a
  origem específica.

## Runbook de deploy

Ver [`docs/SECURITY-HEADERS-DEPLOY.md`](../SECURITY-HEADERS-DEPLOY.md).
