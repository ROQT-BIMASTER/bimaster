

# Auditoria de Seguranca — Gaps Criticos em Edge Functions

## Diagnostico

O sistema possui 179 Edge Functions. A documentacao do Portal de APIs afirma que **todas** possuem Security Headers, WAF L7, Rate Limiting e autenticacao. A realidade e diferente:

| Camada de Seguranca | Implementado | Ausente | Cobertura |
|---------------------|-------------|---------|-----------|
| CORS handling | 160 | 19 | 89% |
| Security Headers (CSP, X-Frame) | 15 | 164 | **8%** |
| Autenticacao (JWT/API Key) | 50 | 129 | **28%** |
| Rate Limiting | 47 | 132 | **26%** |
| WAF L7 (SQLi, XSS, bots) | 7 | 172 | **4%** |

### Impacto

A documentacao na secao "Seguranca e Criptografia" afirma:
- "Todas as Edge Functions incluem CSP, X-Frame-Options" — **falso, apenas 8% possuem**
- "WAF L7 em Codigo (20+ patterns)" — **presente em apenas 7 funcoes**
- "Rate limiting de 60 req/min" — **apenas 26% das funcoes possuem**

Isso significa que 129 funcoes podem ser chamadas sem autenticacao, 164 retornam respostas sem headers de seguranca, e 172 nao possuem protecao contra SQL Injection ou XSS nos payloads.

---

## Plano de Correcao

### Fase 1 — Cobertura Massiva via Wrapper (prioridade critica)

Criar um wrapper unificado em `supabase/functions/_shared/secure-handler.ts` que aplica **todas as camadas** automaticamente:

```text
secureHandler(config) => (req) => {
  1. CORS preflight
  2. WAF L7 check
  3. Security Headers
  4. Auth (JWT ou API Key, conforme config)
  5. Rate Limit (conforme config)
  6. Handler do usuario
  7. Response com headers de seguranca
}
```

Isso permite que cada Edge Function seja blindada adicionando 3 linhas:

```text
import { secureHandler } from "../_shared/secure-handler.ts";

Deno.serve(secureHandler({
  auth: "jwt",           // ou "apikey", "any", "none" (para health checks)
  rateLimit: 60,         // req/min
  rateLimitPrefix: "fn-name",
}, async (req, ctx) => {
  // logica de negocio aqui
}));
```

### Fase 2 — Migrar as 20 funcoes mais criticas

Funcoes que manipulam dados financeiros, autenticacao ou dados sensiveis:
1. `admin-reset-password` — sem AUTH, sem SEC, sem RATE
2. `create-admin-users` — sem AUTH, sem SEC, sem RATE
3. `delete-admin-user` — sem AUTH, sem SEC, sem RATE
4. `update-user-password` — sem AUTH, sem SEC, sem RATE
5. `contas-pagar-ai-chat` — sem AUTH, sem SEC, sem RATE
6. `export-all-data` — sem AUTH, sem SEC, sem RATE
7. `conciliacao-bancaria` — sem AUTH, sem SEC, sem RATE
8. `auditoria-contas-pagar` — sem AUTH, sem SEC, sem RATE
9. `auditoria-contas-receber` — sem AUTH, sem SEC, sem RATE
10. `fiscal-iva-api` — sem AUTH, sem SEC, sem RATE
11. `processar-transacao-n8n` — sem AUTH, sem SEC, sem RATE
12. `cobranca-automation-api` — sem AUTH, sem SEC, sem RATE
13. `pluggy-proxy` — sem AUTH, sem SEC, sem RATE (acesso bancario)
14. `pluggy-webhook` — sem AUTH, sem SEC, sem RATE
15. `save-social-account` — sem AUTH, sem SEC, sem RATE
16. `publish-scheduled-posts` — sem AUTH, sem SEC, sem RATE
17. `social-media-cron` — sem AUTH, sem SEC, sem RATE
18. `sync-all-accounts` — sem AUTH, sem SEC, sem RATE
19. `instagram-insights` — sem AUTH, sem SEC, sem RATE
20. `erp-sync-engine` — sem AUTH, sem SEC, sem RATE

### Fase 3 — Migrar funcoes restantes (129 funcoes)

Aplicar o wrapper nas funcoes de IA, exportacao, webhooks e utilitarios, com configuracoes adequadas (algumas funcoes de webhook externo podem precisar de auth "none" + HMAC).

### Fase 4 — Corrigir documentacao

Atualizar a secao "Seguranca e Criptografia" do Portal de APIs para refletir os numeros reais pos-correcao, sem afirmacoes falsas.

---

## Detalhes Tecnicos

### Arquivo novo: `supabase/functions/_shared/secure-handler.ts`

Wrapper que compoe as camadas existentes (`cors.ts`, `security-headers.ts`, `waf.ts`, `auth.ts`, `rate-limit.ts`, `error-handler.ts`) em um pipeline unico.

### Modificacoes por funcao

Cada funcao migrada tera seu `Deno.serve(async (req) => { ... })` substituido por `Deno.serve(secureHandler(config, handler))`. A logica de negocio nao muda — apenas o envelope de seguranca.

### Funcoes com auth especial

- `auth-email-hook`: Chamada pelo Supabase internamente — auth: "none", mas com validacao de secret
- `erp-webhook-inbound`: Recebe webhooks externos — auth: "hmac"
- `pluggy-webhook`, `cobranca-whatsapp-webhook`, `whatsapp-webhook`, `phyllo-webhook`: Webhooks externos — auth: "none" + HMAC/signature
- `api-health-check`: Publico por design — auth: "none", rate limit alto

### Estimativa

- Fase 1 (wrapper): 1 arquivo novo, ~120 linhas
- Fase 2 (20 criticas): 20 arquivos editados, ~5 linhas cada
- Fase 3 (129 restantes): 129 arquivos editados, ~5 linhas cada
- Fase 4 (docs): 1 arquivo editado

Devido ao volume, a implementacao sera feita em lotes de 15-20 funcoes por iteracao.

