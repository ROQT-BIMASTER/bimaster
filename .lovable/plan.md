## Estado real após Ondas 1-3

Auditoria atual confirma o quadro:

| Frente | Hoje | Risco residual |
|---|---|---|
| **A1 — CORS wildcard** | 1 (`shipsgo-webhook`, intencional) | Encerrado |
| **A2 — secureHandler** | **128 / 223** funções wrapped | 95 sem wrapper, mas **0 totalmente abertas** |
| **A3 — console.\*** | 6 (apenas em `_shared/logger.ts` e `_shared/secure-handler.ts`) | Encerrado |

Triagem das 95 funções sem `secureHandler` (verificado por grep em `validateAnyAuth`, `getClaims`, `auth.getUser`, `X-API-Key`, HMAC, signature):

- **66 funções com auth manual** (`validateAnyAuth` + WAF + rate-limit próprios) — APIs públicas estilo Huggs (clientes, boletos, contas-receber, produtos, etc.) e funções IA/CRM com `auth.getUser`.
- **29 webhooks/integrações HMAC** ou com signature própria — body raw é necessário para verificar assinatura, então `secureHandler` padrão não cabe.

**Nenhuma função está exposta sem auth.** O que falta é apenas uniformizar para ganhar WAF L7 padronizado, security headers (`Strict-Transport-Security`, `X-Content-Type-Options`, etc.) e headers `RateLimit-*` informativos. É **débito técnico**, não vulnerabilidade.

## Proposta: Onda 4 — fechar débito técnico

### Escopo

Migrar para `secureHandler({ auth: "any" })` as **66 funções com auth manual** que já validam JWT/API-key internamente. O `auth: "any"` aceita JWT, API-key e service-role, então não quebra integrações n8n/ERP existentes; ganhamos a pipeline padrão de CORS → WAF → IP blocklist → rate-limit → security headers, **mantendo** a validação interna `validateAnyAuth` (defesa em profundidade, sem mudança de comportamento).

Não tocamos:
- 29 webhooks HMAC (`*-webhook`, `erp-webhook-inbound`, `webhook-dispatcher`, `phyllo-webhook`, etc.) — design diferente (body raw + signature). Documentar como exceção permanente.
- `shipsgo-webhook` CORS wildcard — exceção HMAC já documentada.

### Estratégia de execução

Codemod assistido em 3 lotes, com revisão manual entre eles:

**Lote 4.1 — APIs ERP/Huggs (39 funções)** — todas seguem template `validateAnyAuth → checkRateLimit → handler`:
`anexos-api, bancos-api, bandeiras-api, boletos-api, categorias-api, cidades-api, clientes-api, cnae-api, contas-receber-api, datawarehouse-api, departamentos-api, dre-cadastro-api, empresas-api, estoque-api, finalidades-transferencia-api, fiscal-iva-api (já wrapped), movimentos-financeiros-api, opencnpj-consulta, origens-api, paises-api, parcelas-api, pesquisar-lancamentos-api, produtos-api, projetos-api, resumo-financeiro-api, tipos-anexo-api, tipos-atividade-api, tipos-documento-api, tipos-entrega-api, trade-marketing-api, vendas-union-api, webhook-subscriptions-api, contas-pagar-n8n-sync, erp-export-payment, erp-fornecedores-sync, estoque-n8n-sync, export-datawarehouse, integration-router, sync-dimensao-vendedores`.

Wrap `Deno.serve(secureHandler({ auth: "any", rateLimit: 60, rateLimitPrefix: "<name>" }, async (req, _ctx) => { ...código existente sem o handleCors inicial... }))`. Remover o bloco `if (req.method === 'OPTIONS')` redundante (o middleware trata).

**Lote 4.2 — IA/Marketing/CRM com `auth.getUser` (20 funções)**:
`analyze-brand-positioning, analyze-form-responses, analyze-influencer, apify-bulk-enrich, apify-influencer-search, apify-sync-influencer, asana-reimport-attachments, asana-sync, cnpjbiz-consulta, expense-ai-assistant, extrair-materia-prima-ia, extrair-produto-ia, fetch-influencer-content, geocode-batch, get-google-maps-key, get-mapbox-token, google-places-search, influencer-autopilot, influencer-content-intelligence, ingest-influencer-media, meeting-analyze, meeting-analyze-phase2, meeting-search, meeting-transcribe, price-table-approval, process-call-result, projeto-ia-assistant, realtime-call-session, resolve-post-media, security-ai-sentinel, security-pentest, send-department-expense-notification, send-notifications, sofia-voice-token, stitch-proxy, sync-feriados, validate-influencer-fit, analisar-planilha-ia, ddos-shield, discover-influencers, elevenlabs-narracao, elevenlabs-tts, phyllo-create-user, phyllo-proxy`.

Wrap com `auth: "jwt"`, `rateLimit` adequado:
- IA cara (`analyze-*`, `extrair-*`, `discover-influencers`, `meeting-*`, `apify-*`, `elevenlabs-*`): `rateLimit: 10`.
- Token/proxy (`get-mapbox-token`, `get-google-maps-key`, `sofia-voice-token`, `stitch-proxy`, `phyllo-proxy`): `rateLimit: 60`.
- CRM/notif (`send-notifications`, `send-department-expense-notification`, `process-call-result`, `realtime-call-session`): `rateLimit: 30`.

Remover o boilerplate manual `if (!authHeader) return 401` que o `secureHandler` já faz.

**Lote 4.3 — Crons internos (3 funções)**:
`process-nfe-xml`, `seed-demo-data`, `seed-system-projects` — wrap com `auth: "apikey"`, `rateLimit: 0`.

**Não migrar (29 funções, documentar exceção):**
Webhooks HMAC: `cobranca-whatsapp-webhook`, `erp-webhook-inbound`, `phyllo-webhook`, `shipsgo-webhook`, `webhook-dispatcher`, `webhook-subscriptions-api`, `whatsapp-webhook`, `handle-email-suppression`, e demais funções com signature interna ou que precisam de body raw.

### Verificação

Após cada lote:

```bash
# Contagem de cobertura
for f in supabase/functions/*/index.ts; do grep -q "secureHandler(" "$f" || echo "$f"; done | wc -l
# Esperado: 128 → 89 (após 4.1) → 49 (após 4.2) → 46 (após 4.3) ≈ 29 webhooks HMAC

# Sanidade: nenhuma função perdeu validateAnyAuth/getUser interno
rg "validateAnyAuth|auth\.getUser" supabase/functions --type ts | wc -l  # deve manter
```

Smoke test em 3 funções alvo via `supabase--curl_edge_functions`:
- `boletos-api` POST sem header → 401 (do `secureHandler`).
- `boletos-api` POST com `X-API-Key` válido → 200.
- `get-mapbox-token` GET sem JWT → 401; com JWT → 200.

### Documentação

Atualizar `docs/SECURITY-EDGE-FUNCTIONS-HARDENING.md`:
- Tabela de cobertura final: ~178/223 (80%).
- Lista das 29 exceções permanentes (webhooks HMAC) com justificativa.
- Status: A1/A2/A3 todos encerrados.

## Fora deste plano

- Refactor de `shipsgo-webhook` para um modo `secureHandler` HMAC dedicado (exigiria novo modo de auth no wrapper — mudança de infra, plano separado).
- Migração das funções `*-webhook` para `secureHandler` (requer suporte a body raw no middleware).
