## Escopo

Endereçar dois findings da auditoria de segurança:

- **C26** — 6 webhooks supostamente sem HMAC. Após inspeção, **2 já estão protegidos** e **1 não é webhook público** (é interno admin-only). **3 estão realmente abertos** + 1 corrigir. Detalhe abaixo.
- **C3** — `bimaster.online` sem CSP, X-Frame-Options, Permissions-Policy em produção. Cloudflare Worker já está pronto no repo (`cloudflare/worker.js`), só falta deploy.

## Triagem real do C26 (corrigindo a auditoria)

| Função | Estado atual | Ação |
|---|---|---|
| `shipsgo-webhook` | **Já valida HMAC** via `verifyShipsgoSignature` + `SHIPSGO_WEBHOOK_SECRET`. | Nada. |
| `erp-webhook-inbound` | Já valida `x-api-key` com hash SHA-256 + Zod `.strict()`. | Nada (não é HMAC mas é equivalente — chave secreta hash-comparada). |
| `shipsgo-webhook-replay` | **Não é webhook público**. Tem `auth: "jwt"` + checa role `admin`. Listado por engano. | Nada. Documentar no relatório. |
| `pluggy-webhook` | `auth: "none"`, **sem HMAC**. Risco máximo (transações bancárias). | **Implementar HMAC**. |
| `phyllo-webhook` | Sem `secureHandler`, sem HMAC. | **Implementar HMAC**. |
| `cobranca-whatsapp-webhook` | Apenas `verify_token` Meta no GET. POST sem assinatura. | **Implementar HMAC `x-hub-signature-256`**. |
| `whatsapp-webhook` | Apenas `verify_token` no GET. POST sem assinatura. | **Implementar HMAC `x-hub-signature-256`**. |

## Implementação técnica

### 1. Helper compartilhado (refatorar)

Hoje há `validateHmac(req, body, secret)` em `_shared/auth.ts` que aceita só `x-hub-signature-256` / `x-signature`. Vou estender para suportar diferentes esquemas de fornecedor sem quebrar o existente:

- `_shared/webhook-hmac.ts` (novo) com:
  - `verifyMetaSignature(rawBody, header, secret)` → `x-hub-signature-256` formato `sha256=<hex>`. Usado por WhatsApp Cloud API + `cobranca-whatsapp`.
  - `verifyPluggySignature(rawBody, header, secret)` → header `x-signature` da Pluggy (HMAC-SHA256 hex puro).
  - `verifyPhylloSignature(rawBody, header, secret)` → header `phyllo-signature` (HMAC-SHA256 hex).
  - Todas usam `timingSafeEqual` já existente em `_shared/timing-safe.ts`.

### 2. Mudanças por função (mínimas, padrão idêntico)

Cada webhook público vai:

1. Ler `req.text()` cru **antes** de qualquer parse (HMAC exige body bruto byte-a-byte).
2. Buscar o secret via `Deno.env.get(...)`. Se ausente → `503 webhook secret not configured` + log de erro (fail-closed).
3. Validar a assinatura. Em falha → `401 invalid signature`, registrar evento em `security_events` (`event_type: 'webhook.signature_invalid'`, severity warn).
4. Só então parsear JSON e processar.
5. Mantém `auth: "none"` e `skipWaf: true` (webhook precisa ser público para o provedor chamar).

### 3. Secrets a solicitar ao usuário (via `add_secret`)

| Secret | Onde obter |
|---|---|
| `PLUGGY_WEBHOOK_SECRET` | Pluggy Dashboard → Webhooks → Signing Secret. |
| `PHYLLO_WEBHOOK_SECRET` | Phyllo Dashboard → Webhooks → Secret. |
| `META_WHATSAPP_APP_SECRET` | Meta App Dashboard → Settings → Basic → App Secret. (Pode reutilizar `META_APP_SECRET` que já existe — vou conferir se é o mesmo App; se for, dispenso novo secret.) |

`SHIPSGO_WEBHOOK_SECRET` e `META_APP_SECRET` já existem (vi em `fetch_secrets`). Pluggy e Phyllo precisam ser adicionados.

### 4. Configuração no provedor (manual, do usuário)

Cada provedor precisa do secret cadastrado também no painel deles, apontando para a URL da função. Vou listar URLs no relatório final.

## C3 — Headers de produção

- `cloudflare/worker.js` já tem CSP completa, X-Frame-Options DENY, HSTS preload, Permissions-Policy, COOP/CORP — tudo conforme política do projeto.
- `cloudflare/wrangler.toml` já configurado.
- **Curl em `https://bimaster.online/`** confirma: Cloudflare está na frente (`server: cloudflare`, `cf-ray`), mas só HSTS+referrer+nosniff aparecem. CSP, X-Frame-Options e Permissions-Policy **ausentes** → o Worker **não está roteado** para a zona.
- Causa: Worker nunca foi `wrangler deploy`-ado, **ou** falta a Worker Route no painel CF apontando `bimaster.online/*` → este Worker.

**Não é correção de código.** É deploy + roteamento. Vou:

1. Confirmar/atualizar `cloudflare/wrangler.toml` com o `route` correto para `bimaster.online/*` e `china.bimaster.online/*` (cobrindo o subdomínio).
2. Documentar em `docs/SECURITY-HEADERS-DEPLOY.md` (já existe — atualizar com checklist passo-a-passo: `wrangler login`, `wrangler deploy`, verificação via `curl -I`).
3. Não posso executar `wrangler deploy` (requer credencial Cloudflare). **O usuário roda 1 comando** e valida.

## Validação

Local / pós-merge:

```bash
# Webhooks (deve retornar 401 sem header válido)
curl -X POST https://aokkyrgaqjarhlywhjju.functions.supabase.co/pluggy-webhook \
     -d '{"event":"item/updated","itemId":"x"}' -H 'content-type: application/json'
# → 401 invalid signature

# Headers prod (após o usuário rodar wrangler deploy)
bash scripts/security/e2e-clickjacking.sh   # esperado 7/7 PASS
curl -sI https://bimaster.online/ | grep -iE 'frame|csp|permissions'
```

## Arquivos a alterar

- `supabase/functions/_shared/webhook-hmac.ts` (novo)
- `supabase/functions/pluggy-webhook/index.ts` (adicionar verificação HMAC no início)
- `supabase/functions/phyllo-webhook/index.ts` (mesmo)
- `supabase/functions/cobranca-whatsapp-webhook/index.ts` (mesmo, no branch POST)
- `supabase/functions/whatsapp-webhook/index.ts` (mesmo, no branch POST)
- `cloudflare/wrangler.toml` (rotas de produção, se faltar)
- `docs/SECURITY-HEADERS-DEPLOY.md` (atualizar com runbook)
- `docs/SECURITY.md` (registrar C26 e C3)

## Fora de escopo

- Não vou tocar `shipsgo-webhook`, `shipsgo-webhook-replay`, `erp-webhook-inbound` (já protegidos).
- Não vou implantar o Worker (sem credencial Cloudflare). O usuário roda `npx wrangler deploy`.
- Sem mudança em RLS, schema, frontend, design tokens.

## Sequência de execução (após aprovação)

1. Criar `webhook-hmac.ts` helper.
2. Patch nas 4 funções (deploy automático Lovable Cloud).
3. Pedir ao usuário, via `add_secret`, `PLUGGY_WEBHOOK_SECRET` e `PHYLLO_WEBHOOK_SECRET`. Conferir se `META_APP_SECRET` cobre WhatsApp (se não, pedir `META_WHATSAPP_APP_SECRET`).
4. Atualizar `wrangler.toml` se rota faltar e atualizar runbook.
5. Reportar URLs e comandos finais para o usuário rodar `wrangler deploy` e revalidar.
