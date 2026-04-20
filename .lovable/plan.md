

# Auditoria das APIs do Contas a Pagar — Estado Atual + Gaps Restantes

## O que está sólido (não precisa mexer)

**Funcionalmente completo (PR-1 a PR-23):**
- 19 endpoints CP cobertos: CRUD, upsert idempotente, lote (até 500), pagamentos, estorno, cancelamento, parcelas, anexos, sync incremental/chunks, export ERP completo (11 endpoints).
- **Persistência PR-23 OK**: confirmei no banco — `pagamentos` tem `codigo_pix`, `created_by`; RPC `process_payment_atomic` aceita os 13 parâmetros (com defaults retro-compatíveis).
- **Enriquecimento OK**: `handleConsultar`/`handleQuery` usam embedded selects + `shapeMetaRelacionados`; `handleGetPagamentos` faz JOIN com `contas_bancarias` + `profiles`.
- **5 camadas alinhadas**: Banco ↔ Edge Function ↔ OpenAPI 4.4.0 ↔ SDK 3.3.0 (TS/JS/PY) ↔ regression (33 invariantes PR-23).
- Idempotência server-side em rotas financeiras, ETag/304 em GETs, RateLimit headers universais, validação Zod `.strict()` com mass-assignment protection, validação de referências (fornecedor/categoria/empresa) antes do INSERT.

## Gaps reais identificados (priorizados)

### **Gap 1 — `contas-pagar-api/index.ts` NÃO usa `secureHandler`** (Prioridade ALTA — segurança)

Confirmado: `grep secureHandler` retorna **zero** em `contas-pagar-api/index.ts`. O router roda CORS + auth + rate-limit manualmente, mas **falta**: WAF L7 (`wafCheck`), IP blocklist (`securityCheck`), `withSecurityHeaders` em respostas. Está fora do padrão `edge-function-secure-handler-standard`.
**Impacto**: ataques L7 não filtrados, headers de segurança (CSP/HSTS/X-Frame) ausentes nas respostas.
**Fix**: refatorar `index.ts` para envolver o roteador com `secureHandler({ auth: "any", rateLimit: 120, rateLimitPrefix: "contas-pagar-api" })` — ~40 linhas, mantém roteamento atual.

### **Gap 2 — RLS de `pagamentos` permite SELECT a qualquer authenticated** (Prioridade ALTA — LGPD)

Política `authenticated_select_pagamentos` tem `using_expr = true`. Qualquer usuário autenticado lê **todos** pagamentos da empresa inteira.
**Fix**: trocar por `EXISTS (SELECT 1 FROM contas_pagar cp WHERE cp.id = pagamentos.conta_pagar_id AND cp.empresa_id IN (SELECT empresa_id FROM user_empresas WHERE user_id = auth.uid()))` — semi-join, sem função.

### **Gap 3 — `handleGetRoot` ignora paginação e retorna 100 itens sem filtro** (Prioridade MÉDIA)

`GET /contas-pagar-api` (root) faz `select('*').limit(100)` sem RLS-aware filter por empresa, sem cursor, sem `meta_relacionados`. Inconsistente com `/query`.
**Fix**: redirecionar root para `handleQuery` com defaults, ou aplicar mesmo `enrichedSelect` + filtro `empresa_id` derivado da auth.

### **Gap 4 — Idempotência DUPLA em escrita financeira** (Prioridade MÉDIA — bug latente)

`incluir`/`upsert`/`lancar-pagamento` chamam **`checkIdempotency` interno** dentro do handler E o router envolve em **`withIdempotency` externo** (CP_IDEMPOTENT_ROUTES). Dois mecanismos concorrentes — pode causar race em retries simultâneos com mesma chave.
**Fix**: remover `checkIdempotency`/`saveIdempotency` dos handlers (centralizar no `withIdempotency` do router).

### **Gap 5 — `data_emissao` não está em `IncluirSchema`** (verificar — auditoria PR-23 mencionou mas linha 27 do types.ts MOSTRA o campo presente — pode ter sido fixado já). Confirmar que regression cobre ambos `IncluirSchema` E `UpsertSchema`. **Conclusão da releitura: já está OK.** Sem ação.

### **Gap 6 — `handleEstornar` não enfileira webhook `conta_pagar.estornado`** (Prioridade BAIXA)

Comparado a `cancelar` que dispara `conta_pagar.cancelado`, `estornar` não dispara evento. Webhooks de produção perdem o sinal.
**Fix**: 1 linha — `enqueueWebhookEvent('conta_pagar.estornado', ...)` após o update.

### **Gap 7 — `parcela-handlers.ts` e `anexo-handlers.ts` sem `meta_relacionados`** (Prioridade BAIXA — DX)

`GET /parcelas` e `GET /anexos` retornam só IDs, sem nomes. Mesma queixa que motivou PR-23 para `/consultar`.
**Fix**: aplicar `shapeMetaRelacionados` derivado do título pai.

### **Gap 8 — Falta endpoint OPTIONS estruturado para CORS preflight em multipart** (Prioridade BAIXA)

`/anexos` POST aceita multipart, mas o preflight depende do `handleCors` global — verificar se inclui `Content-Type: multipart/form-data` permitido.

### **Gap 9 — `handleUpsertLote` faz N+1 queries** (Prioridade MÉDIA — performance)

Para cada item do lote (até 500): 1 query `select erp_id`, 1 update OU insert, 1 validação fornecedor, 1 validação categoria. **Até 2000 queries por chamada.**
**Fix**: batch validate referências em 2 IN-queries antes do loop, depois `.upsert()` real do PostgREST.

## Plano sugerido — PR-24 "Production Hardening"

### Fase 1 — Segurança crítica (ALTA)
1. Migração: ajustar RLS de `pagamentos` (semi-join por empresa). 
2. Refatorar `contas-pagar-api/index.ts` para usar `secureHandler` (mantendo roteador interno).
3. Refatorar `contas-pagar-export-api/index.ts` para usar `secureHandler` (atualmente só usa `withSecurityHeaders` solto).

### Fase 2 — Correções de consistência (MÉDIA)
4. Remover `checkIdempotency`/`saveIdempotency` dos handlers (deduplicar com `withIdempotency` do router).
5. `handleGetRoot` → delegar para `handleQuery` com defaults.
6. `handleEstornar` → emitir webhook `conta_pagar.estornado`.
7. `handleUpsertLote` → batch validate referências (2 queries) + `.upsert()` PostgREST real (1 query).

### Fase 3 — DX adicional (BAIXA)
8. `meta_relacionados` em `/parcelas` e `/anexos`.
9. Validar CORS preflight em multipart.

### Fase 4 — Versionamento + regression
10. SDK 3.3.1 (sem mudança de interface — patch), OpenAPI 4.4.1, APP 3.2.1.
11. Changelog inline + 8 invariantes novos:
    - `secureHandler` em `contas-pagar-api/index.ts` ≥1
    - `secureHandler` em `contas-pagar-export-api/index.ts` ≥1
    - `conta_pagar.estornado` no payment-handlers ≥1
    - `checkIdempotency` em handlers (CRUD+payment) =0 (negativo — centralizado)
    - `EXISTS` ou semi-join em policy `pagamentos` ≥1
    - `meta_relacionados` em parcela-handlers ≥1
    - `.upsert(` em handleUpsertLote ≥1

### Fase 5 — Smoke E2E
12. POST `/upsert-lote` com 50 itens → medir latência (esperado <2s vs ~10s atual).
13. POST `/estornar` → confirmar evento na fila de webhooks.
14. Auditoria de segurança: `curl` com header malicioso (XSS payload) → esperar bloqueio do WAF.
15. Login com user secundário → tentar listar `pagamentos` de outra empresa → esperar 0 rows (RLS).

## Não-escopo
- Não tocar nos 6 arquivos React proibidos (`ContasAPagar.tsx` etc).
- Não fazer backfill de dados históricos.
- Não unificar nomenclatura `conta_bancaria_id` vs `id_conta_corrente`.

## Impacto estimado

**~7 arquivos**: `contas-pagar-api/index.ts` (refactor médio ~80 linhas), `contas-pagar-export-api/index.ts` (refactor leve ~30 linhas), `crud-handlers.ts` (-15 linhas idempotência interna; +meta em getRoot), `payment-handlers.ts` (-15 linhas idempotência; +1 webhook estorno), `parcela-handlers.ts` (+10 linhas meta), `anexo-handlers.ts` (+10 linhas meta), `version.ts` + `regression-greps.sh`. **+1 migração** (RLS pagamentos).

**Risco: médio** — refatorar `secureHandler` em produção exige smoke completo. Mudança de RLS pode bloquear telas existentes se houver query sem filtro de empresa (validar antes de aplicar). Idempotência centralizada precisa garantir mesma chave continua funcionando.

