# SSRF Coverage — Edge Functions

Helper: `supabase/functions/_shared/ssrf-guard.ts` exposes
`validateExternalUrl(url)` which throws `SSRFError` for:

- non-HTTPS protocols
- internal/private IP ranges (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, IPv6 `::1`)
- known dangerous hostnames (`localhost`, AWS/GCP metadata)
- internal domain suffixes (`.internal`, `.local`, `.localhost`)
- supabase.co hostnames outside of own project

## Functions with SSRF guard applied (dynamic URLs)

| Function | URL source | Protection |
|---|---|---|
| `webhook-dispatcher` | `webhook_subscriptions.url` (cliente configurável) | `validateExternalUrl` antes do POST |
| `meeting-transcribe` | `audioUrl` body (apenas se sem `storagePath`) | `validateExternalUrl` (signed URLs do Storage isentas) |
| `resolve-post-media` | `mediaUrl` retornada por API externa, persistida em Storage | `validateExternalUrl` antes do download |
| `ingest-influencer-media` | URL do influenciador / post externo | `validateExternalUrl` antes do download |
| `stitch-proxy` | `htmlCode` (cliente pode passar URL para resolver HTML) | `validateExternalUrl` em ambos os call sites |
| `analyze-brand-website` | URL passada pelo usuário | guard original (já existia) |
| `pollo-analyze-website` | URL passada pelo usuário | guard original (já existia) |

## Functions intentionally NOT protected (URL hardcoded)

URLs constantes em código não recebem guard porque o destino nunca varia:

- `apify-*` → `https://api.apify.com`
- `pollo-generate-*`, `pollo-status-*` → endpoints fixos da Pollo
- `elevenlabs-*`, `sofia-voice-token` → `https://api.elevenlabs.io`
- `realtime-call-session` → `https://api.openai.com/v1/realtime/sessions`
- `whatsapp-business-api` → `https://graph.facebook.com/v18.0/...`
- `instagram-insights` → `https://graph.facebook.com/v19.0/...`
- `phyllo-proxy`, `resolve-post-media` (Phyllo branch) → `https://api.getphyllo.com/v1`
- `stitch-proxy` (MCP branch) → `https://stitch.googleapis.com/mcp`
- `pluggy-proxy` → `PLUGGY_CDN_URL`
- `geocode-*`, `google-places-search` → endpoints Google fixos
- `fal-video-*` → `https://fal.run/...`

## Smoke test

```bash
# Bloqueia metadata IMDS
curl -X POST https://<project>.functions.supabase.co/webhook-dispatcher/process \
  -H "Authorization: Bearer $JWT" \
  # Pré-requisito: criar webhook_subscription com url=http://169.254.169.254/...
# → log: SSRF blocked + entrada em webhook_delivery_log com erro

# URL legítima funciona normalmente
# → status 200 + sent++
```

## Rollback

Remover as 3 linhas (`try { validateExternalUrl(...) } catch (...) { ... }`)
e o import. Sem migration de DB.
