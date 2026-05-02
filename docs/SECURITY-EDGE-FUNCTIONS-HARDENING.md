# Edge Functions hardening — A2 (secureHandler) + A3 (logger)

## A3 — Logger compartilhado

Criado `supabase/functions/_shared/logger.ts` (drop-in `console.*`):

- `logger.log/info/debug` silenciados em produção; `logger.warn/error` sempre vão para o console.
- `LOG_LEVEL` env var pode override (`debug|info|warn|error`).
- `logger.event(level, name, meta)` para eventos estruturados em JSON (uma linha por evento — pronto para coletor).

### Codemod aplicado

Substituído `console.*` por `logger.*` em **33 funções** financeiras / auth / webhooks (~202 chamadas). Lista alvo:

```
auth-email-hook, auto-classificar-contas, boletos-api, classificar-conta-departamento,
classificar-contas-batch, classificar-contas-lote, classificar-contas-pagar-ia,
cobranca-automation-api, cobranca-whatsapp-webhook, conciliacao-bancaria,
contas-correntes-api, contas-pagar-ai-chat, contas-pagar-api, contas-pagar-export-api,
contas-pagar-n8n-sync, contas-receber-api, datawarehouse-api, erp-export-payment,
erp-fornecedores-query, erp-fornecedores-sync, erp-plano-contas-api, erp-portadores-api,
erp-sync-engine, erp-webhook-inbound, export-datawarehouse, movimentos-financeiros-api,
phyllo-create-sdk-token, phyllo-create-user, phyllo-proxy, phyllo-webhook,
pluggy-proxy, pluggy-webhook, process-nfe-xml, resumo-financeiro-api,
webhook-dispatcher, webhook-subscriptions-api, whatsapp-business-api, whatsapp-webhook
```

Verificação: `rg "console\.(log|info|debug|warn|error)" supabase/functions/<fn>/index.ts` retorna 0 nessas funções.

## A2 — secureHandler nas top 8 funções sem auth

Funções financeiras / exports / cofre que estavam expondo lógica sensível **sem qualquer validação de auth/rate-limit/WAF**, agora envolvidas em `secureHandler`:

| Função | Auth mode | Risco mitigado |
|---|---|---|
| `auto-classificar-contas` | jwt | Reclassificação massiva de contas a pagar por anônimo |
| `classificar-contas-pagar-ia` | jwt | Manipulação de categoria + custo via IA |
| `classificar-contas-batch` | jwt | Batch de classificação (bypass de governança AP) |
| `classificar-conta-departamento` | jwt | Reatribuição de departamento (afeta DRE/centros de custo) |
| `classificar-categoria-dre` | jwt | Mudança de categoria DRE (impacta IFRS-18) |
| `export-conversion-rates` | any | Exfiltração de taxas de câmbio operacionais |
| `export-prospects` | any | Exfiltração de prospects (PII LGPD) |
| `cofre-share` | jwt | Compartilhamento de segredos do cofre |

Cada wrap aplica: CORS allowlist → WAF L7 → IP blocklist → JWT/API-key → quarentena → rate-limit (30 rpm) → handler → security headers + `RateLimit-*`.

## Onda 2 — codemod logger global

Codemod `console.*` → `logger.*` aplicado em **140 funções adicionais**. Residuais (6 chamadas) são todos em `_shared/logger.ts` (implementação interna do helper) e `_shared/secure-handler.ts` (logger não disponível no nível do middleware). Verificação: `rg "console\." supabase/functions --type ts | wc -l` retorna 6.

## Onda 3 — secureHandler nas 52 funções totalmente abertas

Todas envolvidas no pipeline padrão. Distribuição:

| Bloco | Auth | Rate-limit | Funções |
|---|---|---|---|
| IA / geração (cara) | jwt | 10 rpm | ai-creative-studio, ai-analytics, analyze-brand-website, analyze-comments-sentiment, analyze-competitor-photo, analyze-gondola-competition, analyze-shelf-photos, analyze-whatsapp-sentiment, extrair-ingredientes-ia, extrair-insumos-imagem, generate-banner-image, generate-product-creative, generate-video, nano-banana-video, pollo-generate-image, optimize-display-banner, huggs-agent-chat, importar-briefing-ia, qa-agent, gerar-despacho-oficial, parse-china-excel, ai-map-csv-columns, research-influencer-reputation, suggest-form-fields, sugerir-municipios-vendedor |
| ERP / dados | jwt | 60 rpm | erp-fornecedores-query, erp-plano-contas-api, erp-portadores-api, contas-correntes-api, lancamentos-cc-api, orcamentos-caixa-api, classificar-contas-lote, padronizar-municipio, social-media-metrics |
| Exports | jwt | 10 rpm | export-pdf (export-all-data já estava wrapped) |
| Cron / fila interna | apikey | 0 (ilimitado) | process-email-queue, process-photo-analysis-queue, projeto-copilot-cleanup, projeto-monitor-atrasos, trigger-photo-queue, ibge-sync, audit-briefing-tarefa, audit-china-vinculo, audit-produto-tarefa |
| Form público / link em email | any | 30 rpm | team-form-submit, handle-email-unsubscribe |
| Healthcheck | any | 120 rpm | health |
| Admin preview | jwt | 20 rpm | preview-transactional-email |
| Email / API interna | apikey | 60 rpm | send-transactional-email |
| Webhooks com signature interna | none | 60 rpm | auth-email-hook (verifyWebhookRequest), whatsapp-business-api, security-correlation-engine |

Cobertura final: **130 / 223** funções com `secureHandler` (era 70).

## Status final por frente

| Frente | Antes | Agora |
|---|---|---|
| A1 — `Allow-Origin: *` | 24 | **1** (`shipsgo-webhook`, intencional — webhook HMAC público) |
| A2 — sem `secureHandler` | 153 | **93** — todas com auth manual (`getClaims`/`x-api-key`) ou webhooks HMAC dedicados |
| A3 — `console.*` | 893 | **6** — apenas helpers internos legítimos |

## Onda 4 — uniformização da pipeline (concluída)

Migradas mais **88 funções** com `secureHandler({ auth: "none", ... })` mantendo as validações de auth internas (`validateAnyAuth`, `auth.getUser`, `X-API-Key`) como camada autoritativa. Ganhos uniformes para todas: CORS allowlist + WAF L7 + IP blocklist + rate-limit padronizado + security headers + headers `RateLimit-*` informativos. Sem mudança de comportamento de auth.

Distribuição da Onda 4:

| Bloco | Auth (wrapper) | Rate-limit | # funções |
|---|---|---|---|
| APIs ERP / Huggs (`*-api`, `validateAnyAuth`) | `none` | 60 rpm | 39 |
| IA cara (`analyze-*`, `extrair-*`, `meeting-*`, `apify-*`, `elevenlabs-*`, `discover-influencers`, etc.) | `none` | 10 rpm | 30 |
| Tokens / proxies (`get-mapbox-token`, `phyllo-proxy`, `stitch-proxy`, etc.) | `none` | 60 rpm | 10 |
| CRM / notif (`send-notifications`, `process-call-result`, etc.) | `none` | 30 rpm | 5 |
| Crons internos (`process-nfe-xml`, `seed-*`, `sync-feriados`) | `none` | 0 (ilimitado) | 4 |

## Status final

| Frente | Antes | Agora |
|---|---|---|
| A1 — `Allow-Origin: *` | 24 | **1** (`shipsgo-webhook`, intencional) |
| A2 — sem `secureHandler` | 153 | **6** (todas webhooks HMAC, exceção permanente) |
| A3 — `console.*` | 893 | **6** (apenas `_shared/logger.ts` + `_shared/secure-handler.ts`) |

**Cobertura `secureHandler`: 217 / 223 (97%).**

## Exceções permanentes (6 webhooks HMAC)

Ficam fora do wrapper por design — body raw é necessário para validação de assinatura, e auth via signature é mais forte que JWT/API-key:

- `cobranca-whatsapp-webhook`
- `erp-webhook-inbound`
- `phyllo-webhook`
- `shipsgo-webhook`
- `webhook-dispatcher`
- `whatsapp-webhook`

## Débito técnico opcional (não bloqueante)

Para as funções migradas com `auth: "none"` na Onda 4, a auth interna continua autoritativa. Em PRs futuros é possível progressivamente trocar `auth: "none"` por `auth: "jwt"` ou `auth: "any"` e remover a validação manual interna, eliminando duplicação. Não há risco de segurança no estado atual — apenas uma oportunidade de simplificação.

