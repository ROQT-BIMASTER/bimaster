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

## Pendente (próximos PRs)

- ~45 outras funções sem `secureHandler` (analytics, AI utilitárias, queues internas). Lista em `/tmp/no_secure.txt` (gerada por grep).
- ~20 funções com `Allow-Origin: *` literal restantes (lote 2 de CORS lockdown).
- Codemod `console.*` no resto das 144 funções fora de finance/auth (~700 chamadas restantes).
