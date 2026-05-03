# SSRF Coverage — Edge Functions

Helper: `supabase/functions/_shared/ssrf-guard.ts` expõe
`validateExternalUrl(url)` que lança `SSRFError` para:

- protocolos não-HTTPS
- ranges IP internos/privados (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, IPv6 `::1`)
- hostnames perigosos (`localhost`, AWS/GCP metadata `169.254.169.254`)
- sufixos de domínio interno (`.internal`, `.local`, `.localhost`)
- supabase.co fora do projeto próprio

Total funções com `fetch()`: ~115. Cobertura SSRF: 7 com guard ativo +
~25 com URL hardcoded justificada (não precisam) + restante usa apenas APIs
hardcoded conhecidas (Asana, Mapbox, etc., ver "Restantes" abaixo).

---

## 1. Funções com SSRF guard aplicado (URL DINÂMICA — vinda de body/DB/usuário)

| Função | URL fonte | Protection |
|---|---|---|
| `webhook-dispatcher` | `webhook_subscriptions.url` (cliente configurável) | `validateExternalUrl` antes do POST |
| `meeting-transcribe` | `audioUrl` body (apenas se sem `storagePath`) | `validateExternalUrl` (signed URLs do Storage isentas) |
| `resolve-post-media` | `mediaUrl` retornada por API externa, persistida em Storage | `validateExternalUrl` antes do download |
| `ingest-influencer-media` | URL de mídia externa (avatar/post) | `validateExternalUrl` antes do download |
| `stitch-proxy` | `htmlCode` (cliente pode passar URL para resolver HTML) | `validateExternalUrl` em ambos os call sites |
| `analyze-brand-website` | URL passada pelo usuário | guard original (já existia) |
| `pollo-analyze-website` | URL passada pelo usuário | guard original (já existia) |

---

## 2. Funções intencionalmente SEM guard (URL HARDCODED)

Critério: a URL é **constante string** ou **template com path/query controlados
pelo servidor** — nunca vem de `req.body`, header ou linha de DB editável pelo
cliente. Aplicar guard aqui não traz benefício de segurança e pode quebrar
chamadas legítimas.

### Apify (4)
- `apify-bulk-enrich` → `https://api.apify.com/v2/...`
- `apify-influencer-search` → `https://api.apify.com/v2/...`
- `apify-sync-influencer` → `https://api.apify.com/v2/...`

### Pollo (3 + 1 dinâmica já protegida)
- `pollo-check-status`, `pollo-generate-image`, `pollo-generate-video` → `https://pollo.ai/api/...`
- `pollo-analyze-website` → **com guard** (URL vinda do usuário)

### ElevenLabs (4)
- `elevenlabs-music`, `elevenlabs-narracao`, `elevenlabs-sfx`, `elevenlabs-tts` → `https://api.elevenlabs.io/v1/...`
- `sofia-voice-token` → `https://api.elevenlabs.io/v1/convai/...`

### Geocoding / Maps (3)
- `geocode-address`, `geocode-batch` → `https://api.mapbox.com/geocoding/...`
- `google-places-search` → `https://maps.googleapis.com/maps/api/place/...`

### CNPJ / fiscal (2)
- `opencnpj-consulta` → `https://api.opencnpj.org/...`
- `cnpjbiz-consulta` → `https://api.cnpj.biz/...`

### fal.ai (2)
- `fal-video-generate`, `fal-video-status` → `https://fal.run/...`

### Realtime / OpenAI (1)
- `realtime-call-session` → `https://api.openai.com/v1/realtime/sessions`

### Meta / WhatsApp / Instagram (2)
- `whatsapp-business-api` → `https://graph.facebook.com/v18.0/<PHONE_ID>/messages`
- `instagram-insights` → `https://graph.facebook.com/v19.0/...` (todas as 9 chamadas usam o template fixo + token do servidor)

### Phyllo (1)
- `phyllo-proxy` → `https://api.getphyllo.com/v1/...` (todas as 13 chamadas usam `PHYLLO_BASE`)

### Stitch MCP (1 + dinâmica já protegida)
- `stitch-proxy` (chamadas MCP) → `STITCH_MCP_URL = https://stitch.googleapis.com/mcp` (constante)
- `stitch-proxy` (resolução de `htmlCode`) → **com guard** (URL vinda do request)

### Pluggy / open finance (1)
- `pluggy-proxy` → `PLUGGY_CDN_URL` (constante de ambiente)

### AI Gateway interno (todas funções de IA)
- `ai-insights`, `sofia-*`, `central-copilot-*`, `projeto-copilot-*`, `ai-creative-studio`, `qa-agent`, `support-assistant`, `nano-banana-*` etc. → `https://ai.gateway.lovable.dev/...` via wrapper `callAIGateway` (URL constante)

### Restantes (Asana, ERP Huggs, Shipsgo, n8n, AWS S3 internos, etc.)
Auditadas amostralmente: todas usam URL constante de ambiente
(`ASANA_API_BASE`, `ERP_HUGGS_BASE`, `SHIPSGO_API`, etc.). Caso futura função
introduza URL vinda do request, esta lista deve ser atualizada e o guard
aplicado.

**Regra geral:** se a URL contém substring derivada de `req.json()`,
`req.headers.get(...)`, ou de coluna de tabela editável pelo cliente final
(não admin-only), **APLICAR GUARD**. Em dúvida, aplicar.

---

## 3. Smoke tests

```bash
# ❌ Bloqueia metadata IMDS (espera-se SSRF blocked no log + status falha)
# Pré-requisito: criar webhook_subscription com url=http://169.254.169.254/latest/meta-data/
curl -X POST https://<project>.functions.supabase.co/webhook-dispatcher/process \
  -H "Authorization: Bearer $JWT"
# → webhook_delivery_log: erro "SSRF blocked: Protocolo não permitido: http:" ou "IP privado bloqueado: 169.254.169.254"
# → webhook_event_queue.status: failed/dead

# ✅ URL legítima HTTPS funciona
# webhook_subscription com url=https://hooks.slack.com/services/...
# → status sent, http_status 200
```

Para `meeting-transcribe`, `resolve-post-media`, `ingest-influencer-media`,
`stitch-proxy`: passar `audioUrl`/`mediaUrl`/`htmlCode` apontando para
`http://169.254.169.254/...` deve falhar silenciosamente (warn no log + retorno
nulo / break no loop), nunca disparar fetch real.

---

## 4. Rollback

Por função: remover as 2-3 linhas (`try { validateExternalUrl(...) } catch
(...) { ... }`) e o import `ssrf-guard.ts`. Sem migration de DB.
