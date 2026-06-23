# EDGE_FUNCTIONS_REVIEW — Auditoria 2026-Q2

> Snapshot descritivo das edge functions em `supabase/functions/`. Junho/2026.
> Complementa (não substitui) `docs/EDGE_FUNCTIONS.md`.

## 1. Totais

| Métrica | Valor |
| --- | ---: |
| Funções (excluindo `_shared`) | **274** |
| Arquivos em `_shared/` | 30 |
| Funções com `auth: "none"` | 120 |
| Funções com `rateLimit: 0` | 13 |
| Funções que importam `callAIGateway` | ver §4 |

## 2. Top prefixos (10)

| Prefixo | Funções |
| --- | ---: |
| `projeto-*` | 10 |
| `china-*` | 9 |
| `analyze-*` | 9 |
| `shipsgo-*` | 8 |
| `erp-*` | 8 |
| `security-*` | 6 |
| `notion-*` | 5 |
| `export-*` | 5 |
| `contas-*` | 5 |
| `classificar-*`, `central-*`, `ai-*` | 5 cada |

## 3. Biblioteca `_shared`

Helpers canônicos atuais (referenciados por AGENTS.md §7):

| Arquivo | Função |
| --- | --- |
| `secure-handler.ts` | Pipeline auth → WAF → IP blocklist → JWT/API-key → quarentena → MFA → step-up → rate-limit → handler → security headers |
| `ai-gateway-call.ts` | Wrapper IA com fallback 429→flash, tradução de erros e i18n (PT/EN/ZH via `pickLang`) |
| `cors.ts` | `getCorsHeaders(req)` |
| `waf.ts` (implícito no pipeline) | Detecção L7 |
| `rate-limit.ts` | Buckets por usuário/IP |
| `security-headers.ts`, `security-middleware.ts` | HSTS, CSP, X-Frame-Options |
| `auth.ts`, `admin-jwt.ts`, `totp.ts` | Validação JWT + MFA TOTP |
| `error-handler.ts`, `response.ts`, `logger.ts` | Padronização |
| `idempotency.ts`, `timing-safe.ts`, `ssrf-guard.ts` | Anti-replay, comparação constante, anti-SSRF |
| `copilot/`, `rag/` | Copilot v2 (citação, propostas, RAG `halfvec(3072)`) |
| `notion-client.ts`, `shipsgo.ts`, `erp-mssql.ts`, `email-templates/` | Conectores externos |
| `audit-log.ts` | Log imutável |

## 4. Achados de segurança (cruzados com o scanner)

Os achados abaixo estão registrados pelo scanner do projeto. Esta seção é
descritiva — **não corrige** nada neste PR (audit-only).

### 4.1 🟠 [WARN] `auth: "none"` é frequente (120 funções)
Nem toda função é problemática (webhooks, cron triggers internas, callbacks
públicos). Mas o subset abaixo requer ação em PR posterior (já flagado pelo scanner):

| Função | Risco apontado |
| --- | --- |
| `create-admin-users-bootstrap` | bypassa MFA step-up; criar admin sem 2º fator |
| `cron-estoque-trigger` | dispara sync multi-empresa sem `x-cron-secret` (apenas repassa downstream) |
| `process-nfe-xml` | `auth: "none"` + `rateLimit: 0` + grava XML cru em `fabrica_notas_fiscais` |
| `seed-demo-data` | `auth: "none"` + `rateLimit: 0` insere ~30 linhas em 12 tabelas |

**Padrão de remediação recomendado** (a aplicar em PR de remediação, fora deste ciclo):

```ts
// Cron com segredo no header
const provided = req.headers.get('x-cron-secret') ?? '';
const expected = Deno.env.get('CRON_SECRET') ?? '';
if (!provided || !timingSafeEqual(provided, expected)) {
  return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: cors });
}

// OU bootstrap com MFA step-up
secureHandler({
  auth: "jwt",
  requireMfa: true,
  requireStepUp: "user.create.admin",
  mfaFailMode: "closed",
})
```

### 4.2 🟡 [MÉDIO] 13 funções com `rateLimit: 0`
Inventário completo deve ser emitido pelo PR-4 (`scripts/audit/list-edge.ts`).
Definir política mínima: toda função com escrita em DB exige `rateLimit ≥ 1`,
salvo whitelisting documentado.

### 4.3 🟢 [OK] Padrão `secureHandler` amplamente adotado
A esmagadora maioria das 274 funções consome `secureHandler`. Não foram
encontradas funções chamando `https://ai.gateway.lovable.dev/...` diretamente
fora do wrapper `callAIGateway`.

### 4.4 🟢 [OK] CORS centralizado
Não há `const corsHeaders = {...}` duplicado em funções — todas usam o helper.

## 5. Recomendações priorizadas

| Prioridade | Item | PR sugerido |
| --- | --- | --- |
| Alta | Corrigir os 4 achados nominais do scanner (§4.1) | PR de remediação dedicado |
| Média | Listar e justificar todas as 120 funções `auth: "none"` (whitelist com motivo) | PR-4 (automação) |
| Média | Política mínima `rateLimit ≥ 1` para escrita | PR-4 |
| Baixa | Documentar `_shared/copilot/*` e `_shared/rag/*` em detalhe | PR de docs Copilot v2 |

## 6. Como reproduzir

```bash
# Total
ls supabase/functions | grep -v '^_' | wc -l

# auth: "none"
rg -l 'auth: ?"none"' supabase/functions | wc -l

# rateLimit: 0
rg -l 'rateLimit: ?0\b' supabase/functions | wc -l

# Prefixos
ls supabase/functions | grep -v '^_' | sed 's/-.*//' | sort | uniq -c | sort -rn
```
