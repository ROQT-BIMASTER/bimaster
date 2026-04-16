

# Profissionalização — APIs Contas a Pagar

## Fase 1 — P0: Segurança Financeira

### 1A. Idempotência

Criar tabela `idempotency_keys` e middleware que intercepta POST requests com header `X-Idempotency-Key`. Se a key ja existe e foi processada, retorna a resposta cached. Evita duplicatas em `/incluir`, `/lancar-pagamento`, `/upsert`.

| Arquivo | Alteração |
|---|---|
| Migration SQL | Criar tabela `idempotency_keys (key, endpoint, response, status, created_at, expires_at)` com TTL de 24h |
| `_shared/contas-pagar/utils.ts` | Adicionar `checkIdempotency()` e `saveIdempotency()` |
| `crud-handlers.ts` | Aplicar em `handleIncluir`, `handleUpsert`, `handleUpsertLote` |
| `payment-handlers.ts` | Aplicar em `handleRegistrarPagamento`, `handleLancarPagamento` |

### 1B. Transações Atomicas (Pagamento)

Criar RPC `process_payment_atomic` que faz INSERT em `pagamentos` + UPDATE em `contas_pagar` em uma unica transação. Substituir as duas queries separadas em `processPayment()`.

| Arquivo | Alteração |
|---|---|
| Migration SQL | Criar function `process_payment_atomic(...)` SECURITY DEFINER |
| `payment-handlers.ts` | `processPayment()` chama RPC em vez de INSERT + UPDATE separados |

## Fase 2 — P1: Robustez

### 2A. Rate Limiting Global

Aplicar `checkRateLimit` (ja existe em `_shared/rate-limit.ts`) nos endpoints CRUD e pagamentos. Configurar 120 req/min por API key, 60 req/min por JWT.

| Arquivo | Alteração |
|---|---|
| `contas-pagar-api/index.ts` | Adicionar `checkRateLimit` no router antes do dispatch |

### 2B. Validação de Query Params

Criar schemas Zod para query params dos endpoints GET (`listar`, `query`, `consultar`, `pagamentos`, `parcelas`).

| Arquivo | Alteração |
|---|---|
| `types.ts` | Adicionar `ListarParamsSchema`, `QueryParamsSchema`, `ConsultarParamsSchema` |
| `crud-handlers.ts` | Validar params com Zod antes de construir query |
| `payment-handlers.ts` | Validar params em `handleGetPagamentos` |

### 2C. Zod em endpoints sem validação

Adicionar schemas para `handleEstornar` e `handleRegistrarPagamento`.

| Arquivo | Alteração |
|---|---|
| `types.ts` | Adicionar `EstornarSchema`, `RegistrarPagamentoSchema` |
| `payment-handlers.ts` | Substituir validação manual por Zod |

## Fase 3 — P2: Padronização

### 3A. Envelope de Resposta Unificado

Wrapper `apiResponse()` que adiciona `request_id`, `api_version`, `timestamp` em todas as respostas. Headers `X-Request-Id` e `X-API-Version`.

| Arquivo | Alteração |
|---|---|
| `utils.ts` | Criar `apiResponse()` que encapsula `jsonRes()` |
| Todos os handlers | Substituir `jsonRes()` por `apiResponse()` |

### 3B. Aggregação SQL (Export API)

Substituir processamento em memória de `handleReconciliation` e `handleExportSummary` por RPCs com `GROUP BY`.

| Arquivo | Alteração |
|---|---|
| Migration SQL | Criar RPCs `get_reconciliation_summary` e `get_export_summary` |
| `contas-pagar-export-api/index.ts` | Chamar RPCs em vez de fetch + loop |

### 3C. Paginação Cursor-Based

Adicionar suporte a `cursor` como alternativa a `offset` nos endpoints `/listar` e `/query`.

| Arquivo | Alteração |
|---|---|
| `crud-handlers.ts` | Detectar param `cursor` e usar `gt('id', cursor)` em vez de `range()` |

## Fase 4 — P3: Developer Experience

### 4A. Documentação Atualizada

Regenerar `docs/API_CONTAS_PAGAR.md` com todos os 30 endpoints, remover URLs internas, adicionar exemplos de idempotência e paginação cursor.

### 4B. Health Check Enriquecido

Expandir `/status` com latência do banco, contagem de slots ativos e versão do schema.

| Arquivo | Alteração |
|---|---|
| `infra-handlers.ts` | Adicionar ping ao banco e metadata no `/status` |

## Impacto

- Zero breaking changes — tudo e aditivo
- Idempotência e transações eliminam os dois maiores riscos financeiros
- Rate limiting previne abuso
- Envelope padronizado facilita integração com ERPs

## Estimativa

- Fase 1: 2 migrations + 2 arquivos
- Fase 2: 3 arquivos
- Fase 3: 2 migrations + 4 arquivos
- Fase 4: 2 arquivos

