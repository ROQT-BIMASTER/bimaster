# CORS Lockdown — Edge Functions sensíveis

## Contexto (Finding A1)

Auditoria identificou ~24 Edge Functions devolvendo `Access-Control-Allow-Origin: *`. Browsers de qualquer site podiam invocar essas funções com a sessão do usuário autenticado.

## Lote 1 — funções financeiras / dados (este PR)

Substituído wildcard por `getCorsHeaders(req)` (allowlist em `supabase/functions/_shared/cors.ts`):

| Função | Risco mitigado |
|---|---|
| `datawarehouse-api` | Exfiltração cross-origin de dimensões/fatos (vendas, trade, KPIs) |
| `boletos-api` | Geração/cancelamento de boletos a partir de site malicioso com cookie da vítima |
| `conciliacao-bancaria` | Acesso a transações Pluggy/Open Finance |
| `erp-fornecedores-sync` | Sync de fornecedores ERP Huggs |

## Comportamento da allowlist

- Origens permitidas: `bimaster.online` e subdomínios, `bimaster.lovable.app`, preview Lovable, mais `ALLOWED_ORIGINS` (env, opcional CSV).
- Server-to-server (n8n, ERP, cron — sem header `Origin`): segue funcionando normalmente. Browsers não conseguem forjar header `Origin`.
- Origem fora da allowlist: header `Allow-Origin` vai vazio → browser bloqueia a resposta.

## Validação

```bash
# Permitido
curl -i -X OPTIONS https://aokkyrgaqjarhlywhjju.functions.supabase.co/datawarehouse-api \
  -H "Origin: https://bimaster.online" \
  -H "Access-Control-Request-Method: POST"

# Bloqueado
curl -i -X OPTIONS https://aokkyrgaqjarhlywhjju.functions.supabase.co/datawarehouse-api \
  -H "Origin: https://evil.example.com" \
  -H "Access-Control-Request-Method: POST"
```

## Próximos lotes (fora deste PR)

Outras ~20 funções com `Allow-Origin: *` literal a serem migradas em PRs subsequentes (analyze-influencer, asana-sync, auto-classificar-contas, elevenlabs-narracao, fetch-influencer-content, handle-email-unsubscribe, send-transactional-email, qa-agent, estoque-api, etc.).
