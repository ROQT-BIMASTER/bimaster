---
title: Integrações externas
audience: ai-coding-agent
last_updated: 2026-05-02
---

# 10 — Integrações externas

## Padrões transversais

- Toda chamada externa em **Edge Function** (nunca client → API externa direta
  com chave).
- Use `_shared/ssrf-guard.ts` para fetches dinâmicos (URL vinda do usuário).
- Use `_shared/idempotency.ts` em endpoints que recebem webhook.
- Use `_shared/timing-safe.ts` para comparar tokens/HMAC.
- Secrets via tool de secrets do Lovable. Variáveis padrão:
  `<PROVIDER>_API_KEY` ou `<PROVIDER>_SECRET`.

---

## Asana

- **Sync bidirecional** entre Projetos/Tarefas locais e Asana.
- Protocolo de **2 fases** com timeouts:
  1. Pull — busca diffs no Asana.
  2. Push — aplica mudanças locais e remotas.
- Re-import de anexos isolado em `asana-reimport-attachments`.
- Memória: `mem://integrations/asana-sync-full-standard-v2025`.

---

## Shipsgo (Torre de Containers)

- Tracking de containers BR↔CN.
- Edge functions: `shipsgo-diff-detect`, `shipsgo-ia-diff`,
  `shipsgo-autofix-apply`, `shipsgo-webhook-replay`.
- Hook front: `src/hooks/useShipsgoIntegration.ts`.
- Webhook log: `shipsgo_webhook_log`. Análises IA: `shipsgo_ia_analises`.
- Auto-fix exige **reauth por senha** (admin only).
- Tabela admin: `src/pages/admin/ShipsgoIntegracao.tsx`.

---

## Phyllo (Influencer Data)

- Conecta Instagram, TikTok, YouTube via tokens Phyllo.
- Edge: ver `supabase/functions/social-*` (e relacionadas).
- Memória: `mem://features/marketing/social-networks-phyllo-hub`.

---

## Apify

- Enrichment em massa de perfis de influencer.
- Edge: `apify-bulk-enrich`, `apify-influencer-search`, `apify-sync-influencer`.
- Rate-limit alto; usar batches.

---

## fal.ai

- Geração de imagens/vídeos para AI Creative Studio (alternativa aos modelos
  do gateway quando necessário).
- Edge: `ai-creative-studio` e correlatas.
- Memória: `mem://features/marketing/ai-creative-studio-infrastructure`.

---

## Pluggy (Open Finance)

- SDK: `pluggy-connect-sdk` + `react-pluggy-connect`.
- Conecta contas bancárias para conciliação.
- Tokens de curta duração — renovar via edge function própria.

---

## ERP Huggs

- Sync de produtos, fornecedores, contas a pagar/receber, NF-e.
- Validação de chave em `_shared/erp-key-validator.ts`.
- Webhooks documentados em `docs/N8N_WEBHOOK_*.md`.
- Endpoints públicos REST documentados em `docs/API_*.md` (~30 arquivos).
- Sandbox: `supabase/functions/api-sandbox`.
- Health-check: `supabase/functions/api-health-check`.

---

## ElevenLabs

- TTS para Sofia e LiveTranscription (CRM).
- SDK: `@elevenlabs/react`.
- Página: `src/pages/ElevenLabsStudioPage.tsx`.
- Componente: `src/components/crm/LiveTranscription.tsx`.

---

## Mapas

### Mapbox GL

- `mapbox-gl`.
- Token: secret server-side (forneça via edge function ao front).
- Páginas: `Mapa.tsx`, `MunicipiosIntelligence.tsx`, `ComercialMapa.tsx`.

### Google Maps

- `@vis.gl/react-google-maps` + `@googlemaps/markerclusterer`.
- Mesma política de token.

---

## WhatsApp / Mensageria

- Monitoring em `src/pages/WhatsAppMonitoring.tsx`.
- Análise de sentimento em `analyze-whatsapp-sentiment`.
- Filtros e agente em `src/components/whatsapp/`.

---

## NF-e (parser XML)

- `src/lib/fabrica/nfe-xml-parser.ts`.
- Parsing local, sem dependência externa.

---

## Stripe (potencial)

- Conector disponível via `payments--enable_stripe_payments` e tools `stripe--*`.
- Não implementado por padrão. Quando ativar, edge function própria com webhook
  validado.

---

## Pluggy / Cloudflare Worker

- `cloudflare/worker.js` + `wrangler.toml`.
- Edge layer adicional para alguns endpoints públicos.

---

## API REST pública (documentação)

`docs/API_*.md` (~30 arquivos): contratos REST do ERP/PLM. Sempre que mudar:

1. Atualize o `.md` correspondente.
2. Atualize o changelog em `src/pages/admin/ApiDocumentation.tsx` (CI faz grep).

Ver [`12-RELEASE-AND-CHANGELOG.md`](./12-RELEASE-AND-CHANGELOG.md).
