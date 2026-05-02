## Escopo (somente A1, conforme suas respostas)

Substituir `Access-Control-Allow-Origin: "*"` literal por `getCorsHeaders(req)` (com allowlist) em **4 funções sensíveis**:

- `datawarehouse-api` — exporta dimensões/fatos (clientes, vendas, trade)
- `boletos-api` — gera/cancela boletos (cobrança bancária)
- `conciliacao-bancaria` — conciliação extrato ↔ contas a pagar
- `erp-fornecedores-sync` — sincroniza fornecedores ERP Huggs

A2 (113 funções sem `secureHandler`) e A3 (897 `console.*`) ficam para próximas mensagens, conforme solicitado.

## Diagnóstico por arquivo

| Arquivo | Estado | Mudança |
|---|---|---|
| `datawarehouse-api/index.ts` | Define const local `DW_CORS` com `*` em 9 lugares. Já importa `getCorsHeaders` mas não usa. | Remover `DW_CORS`, trocar todos os `headers: { ...DW_CORS, ... }` por `headers: { ...getCorsHeaders(req), ... }`. Atualizar `handleCors`. |
| `boletos-api/index.ts` | 1 ocorrência: `wafBlockResponse(waf, { "Access-Control-Allow-Origin": "*" })`. Resto já usa `handleCors`. | Trocar por `wafBlockResponse(waf, getCorsHeaders(req))`. |
| `conciliacao-bancaria/index.ts` | Define const local `corsHeaders` com `*` (linha 6). | Remover const, usar `getCorsHeaders(req)` em todas as Response. |
| `erp-fornecedores-sync/index.ts` | 1 ocorrência no fallback do WAF. | Trocar por `getCorsHeaders(req)`. |

## Por que `getCorsHeaders` é seguro

`supabase/functions/_shared/cors.ts` já implementa allowlist:

- Domínios canônicos: `bimaster.online`, `www.bimaster.online`, `china.bimaster.online`, `*.bimaster.online`, preview Lovable.
- Origens server-to-server (sem header `Origin`) — n8n, ERP, cron — recebem headers vazios de Allow-Origin (browser ignora; chamada direta funciona normal).
- Pode ser estendido via env `ALLOWED_ORIGINS`.

Isso fecha o CORS para navegador sem quebrar integrações server-to-server (que é como `boletos-api`/`datawarehouse-api` realmente são consumidos pelo n8n e ERP — não passam header `Origin`).

## Risco e mitigação

- **Risco**: algum cliente externo legítimo chamando do navegador de domínio fora da allowlist deixaria de funcionar.
- **Realidade no projeto**: essas 4 funções são chamadas pelo próprio app (`bimaster.online`) ou server-to-server (n8n/ERP). Front interno está coberto pela allowlist. n8n/ERP não usam `Origin`.
- Se aparecer cliente novo, basta adicionar à env `ALLOWED_ORIGINS` (sem deploy de código).

## Validação

Após edits (Lovable Cloud auto-deploya as functions):

```bash
# Origem permitida → retorna o próprio Origin
curl -i -X OPTIONS https://aokkyrgaqjarhlywhjju.functions.supabase.co/datawarehouse-api \
  -H "Origin: https://bimaster.online" \
  -H "Access-Control-Request-Method: POST"
# Esperado: Access-Control-Allow-Origin: https://bimaster.online

# Origem maliciosa → header vazio (browser bloqueia)
curl -i -X OPTIONS https://aokkyrgaqjarhlywhjju.functions.supabase.co/datawarehouse-api \
  -H "Origin: https://evil.example.com" \
  -H "Access-Control-Request-Method: POST"
# Esperado: Access-Control-Allow-Origin: (vazio ou ausente)

# Server-to-server (n8n/ERP, sem Origin) → continua funcionando
curl -i https://aokkyrgaqjarhlywhjju.functions.supabase.co/boletos-api/health \
  -H "x-api-key: ..."
# Esperado: 200 OK
```

Smoke test no app: abrir `/dashboard` → deve carregar dashboards (datawarehouse-api), abrir `/financeiro/conciliacao-bancaria`, e fluxo de boleto.

## Arquivos a alterar

- `supabase/functions/datawarehouse-api/index.ts`
- `supabase/functions/boletos-api/index.ts`
- `supabase/functions/conciliacao-bancaria/index.ts`
- `supabase/functions/erp-fornecedores-sync/index.ts`
- `docs/SECURITY-WEBHOOKS-HMAC.md` ou novo `docs/SECURITY-CORS-LOCKDOWN.md` — registro do hardening (1 parágrafo).

## Fora de escopo (próximas mensagens)

- Outras 20 funções com `Allow-Origin: *`.
- A2: top 10 críticas para `secureHandler` — vou levantar a lista priorizada quando você pedir.
- A3: codemod `console.*` → `logger.*` em funções de finance/auth.
- Cloudflare Worker deploy (já documentado anteriormente — pendente do seu `wrangler deploy`).
