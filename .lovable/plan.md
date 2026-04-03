

# Auditoria Completa das APIs (Edge Functions) — Nota: 72/100

## Pontuação por Categoria

| Categoria | Nota | Peso | Pontos |
|---|---|---|---|
| Consistência Arquitetural | 55 | 25% | 13.75 |
| Segurança | 80 | 25% | 20.0 |
| Validação de Entrada | 45 | 20% | 9.0 |
| Observabilidade / Erros | 70 | 15% | 10.5 |
| Manutenibilidade / DRY | 60 | 15% | 9.0 |
| **TOTAL** | | | **72/100** |

---

## PROBLEMAS IDENTIFICADOS

### CRÍTICO 1: Inconsistência massiva de imports e CORS (–15pts)

Existem **3 padrões coexistentes** de imports e CORS:

| Padrão | Funções que usam | Problema |
|---|---|---|
| `_shared/cors.ts` + `_shared/response.ts` | bancos-api, boletos-api, empresas-api | Correto — usa origin lockdown |
| `corsHeaders` hardcoded com `*` | api-sandbox, produtos-api, integration-router, api-health-check | CORS aberto para qualquer origem |
| `_shared/cors.ts` + `json()` local | categorias-api, lancamentos-cc-api, webhook-dispatcher | Duplica `jsonResponse` de `_shared/response.ts` |

**Impacto**: APIs com `Access-Control-Allow-Origin: *` permitem chamadas de qualquer site, expondo endpoints sensíveis a ataques CSRF.

**Funções afetadas**: `api-sandbox`, `produtos-api`, `integration-router`, `api-health-check` (~4 funções)

### CRÍTICO 2: Ausência de validação Zod na maioria das APIs (–12pts)

Apenas `erp-webhook-inbound` usa Zod para validar o body. Todas as outras APIs (boletos-api, clientes-api, contas-pagar-api, categorias-api, etc.) aceitam `await req.json()` sem validação de schema — vulnerável a mass-assignment e injection.

**Funções afetadas**: ~25+ funções de CRUD

### CRÍTICO 3: Padrões de autenticação inconsistentes (–8pts)

| Padrão | Funções |
|---|---|
| `validateAnyAuth()` (JWT + API Key) | bancos-api, boletos-api, empresas-api, departamentos-api |
| `validateErpAuth()` (API Key + legacy env) | lancamentos-cc-api |
| `validateApiKey()` (só API Key) | categorias-api |
| Auth manual inline | produtos-api, integration-router, contas-receber-api |
| Sem auth (só header check) | api-health-check |

**Impacto**: Functions com auth manual não usam timing-safe comparison e não verificam `erp_api_keys`.

### PROBLEMA 4: Import de Supabase client com versões divergentes (–5pts)

| Import | Funções |
|---|---|
| `npm:@supabase/supabase-js@2` | bancos-api, boletos-api, departamentos-api (correto) |
| `https://esm.sh/@supabase/supabase-js@2` | erp-webhook-inbound |
| `https://esm.sh/@supabase/supabase-js@2.58.0` | produtos-api |

Versões fixas em `esm.sh` ficam defasadas e podem causar bugs de incompatibilidade.

### PROBLEMA 5: Funções sem rate limiting (–5pts)

APIs sem `checkRateLimit`: `produtos-api`, `integration-router`, `api-health-check`, `contas-pagar-export-api` (usa check manual).

### PROBLEMA 6: Funções sem security headers (–3pts)

APIs que não incluem `X-Content-Type-Options`, `X-Frame-Options`, etc.: `api-sandbox`, `produtos-api`, `integration-router`, `api-health-check`.

### PROBLEMA 7: Helper `json()` duplicado em ~8 funções (–3pts)

`categorias-api`, `lancamentos-cc-api`, `webhook-dispatcher`, `erp-webhook-inbound`, `contas-pagar-api` — cada uma define sua própria função `json()` em vez de usar `_shared/response.ts`.

### PROBLEMA 8: `serve()` deprecado vs `Deno.serve()` (–2pts)

`erp-webhook-inbound` ainda usa `serve()` de `deno.land/std@0.168.0`, que é deprecado. Todas as outras funções modernas usam `Deno.serve()`.

---

## PLANO DE CORREÇÃO (28 pontos para 100%)

### Fase 1: Segurança — CORS + Auth (–23pts → 0)

**1a. Migrar 4 funções com CORS `*` para `_shared/cors.ts`:**
- `api-sandbox/index.ts`
- `produtos-api/index.ts`
- `integration-router/index.ts`
- `api-health-check/index.ts`

**1b. Migrar 3 funções com auth manual para `_shared/auth.ts`:**
- `produtos-api` → usar `validateAnyAuth()`
- `integration-router` → usar `validateAnyAuth()`
- `contas-receber-api` → usar `validateAnyAuth()` ou `validateErpAuth()`

**1c. Adicionar validação Zod nos 6 endpoints de escrita mais críticos:**
- `boletos-api` (POST /gerar, /cancelar, /prorrogar)
- `clientes-api` (POST /incluir, /alterar)
- `categorias-api` (POST /incluir, /alterar)

### Fase 2: Consistência — DRY + Imports (–10pts → 0)

**2a. Eliminar `json()` duplicado em 5 funções**, substituindo por `import { jsonResponse, errorResponse } from "../_shared/response.ts"`:
- `categorias-api`
- `lancamentos-cc-api`
- `webhook-dispatcher`
- `erp-webhook-inbound`
- `contas-pagar-api` (error handler final)

**2b. Padronizar imports de Supabase para `npm:@supabase/supabase-js@2`:**
- `erp-webhook-inbound` (de `esm.sh`)
- `produtos-api` (de `esm.sh@2.58.0`)
- `integration-router` (de `esm.sh`)

**2c. Migrar `erp-webhook-inbound` de `serve()` para `Deno.serve()`.**

### Fase 3: Rate Limiting + Security Headers (–5pts → 0)

**3a. Adicionar `checkRateLimit` em:**
- `produtos-api`
- `integration-router`

**3b. Adicionar `withSecurityHeaders` em:**
- `api-sandbox`
- `produtos-api`
- `integration-router`
- `api-health-check`

### Arquivos a alterar

| Arquivo | Alterações |
|---|---|
| `api-sandbox/index.ts` | CORS lockdown, security headers |
| `produtos-api/index.ts` | CORS, auth, rate limit, security headers, import |
| `integration-router/index.ts` | CORS, auth, rate limit, security headers, import |
| `api-health-check/index.ts` | CORS lockdown, security headers |
| `erp-webhook-inbound/index.ts` | `Deno.serve()`, import padronizado, usar `_shared/response.ts` |
| `boletos-api/index.ts` | Zod schemas para POST endpoints |
| `clientes-api/index.ts` | Zod schemas para POST endpoints |
| `categorias-api/index.ts` | Usar `_shared/response.ts`, Zod schema |
| `lancamentos-cc-api/index.ts` | Usar `_shared/response.ts` |
| `webhook-dispatcher/index.ts` | Usar `_shared/response.ts` |
| `contas-pagar-api/index.ts` | Usar `_shared/response.ts` no error handler |

### Resultado esperado

- 0 funções com CORS `*`
- 0 funções com auth manual inline
- 6 endpoints de escrita com validação Zod
- 0 helpers `json()` duplicados
- Imports padronizados em `npm:`
- Rate limiting em todas as APIs públicas
- Security headers em todas as respostas
- **Nota estimada: 95-100/100**

