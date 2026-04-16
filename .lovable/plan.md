

# Atualizar Documentacao, SDK e OpenAPI — Contas a Pagar Profissionalizado

## Diagnostico

A profissionalizacao das APIs (idempotencia, transacoes atomicas, rate limiting, envelope unificado, cursor pagination, Zod em todos endpoints) foi implementada mas a documentacao, SDK e OpenAPI ainda refletem o estado anterior. Gaps identificados:

### 1. docs/API_CONTAS_PAGAR.md (desatualizado)
- Sem mencao a `X-Idempotency-Key` e `X-Idempotency-Replayed`
- Sem cursor pagination (`cursor` param em `/query` e `/pagamentos`)
- Sem envelope `meta` (`request_id`, `api_version`, `duration_ms`) nas respostas
- Rate limit desatualizado (nao menciona 120/min API Key vs 60/min JWT)
- `/status` nao documenta `health.db_latency_ms` e `active_sync_slots`
- Falta endpoint `GET /chunks-progress`
- Falta `POST /estornar` nos exemplos de resposta
- Versao da API nao reflete `2.4.0`

### 2. Portal ERP — ApiDocumentation.tsx (parcial)
- Rate limit hardcoded como "60 req/min" (linha 812) — falta diferenciar API Key (120) vs JWT (60)
- FLOW patterns nao incluem "Idempotency Check" nos endpoints POST
- Falta param `cursor` nos endpoints `/query`, `/pagamentos`, `/parcelas`
- Falta param `filtrar_por_cpf_cnpj` no `/query`
- Responses nao mostram envelope `meta`
- `/status` response nao reflete health check enriquecido
- Falta info sobre `X-Idempotency-Key` na secao de autenticacao

### 3. SDK — SdkDownloadButtons.tsx (incompleto)
- Versao `2.4.0` correta mas metodos ausentes:
  - `cpConsultar(id/codigo)` — nao existe
  - `cpQuery(params)` — nao existe
  - `cpEstornar(body)` — nao existe
  - `cpRegistrarPagamento(body)` — nao existe
  - `cpGetPagamentos(contaPagarId)` — nao existe
  - `cpGetParcelas(contaPagarId)` — nao existe
- `_request` nao envia `X-Idempotency-Key` automaticamente para POSTs
- `ListarParams` incompleto (falta `filtrar_por_emissao_de/ate`, `filtrar_por_projeto`, `exibir_obs`, `filtrar_por_cpf_cnpj`)
- `cpListar` nao suporta todos os filtros implementados
- Sem suporte a cursor pagination
- Falta `CpEstornarPayload`, `CpRegistrarPagamentoPayload` nos types

### 4. OpenAPI Spec (inline em ApiDocumentation.tsx)
- Schemas faltantes: `MetaEnvelope`, `CursorPagination`, `IdempotencyHeaders`
- `ContaPagarResponse` nao inclui `meta` wrapper
- Falta `x-idempotency-key` como parametro em POST endpoints
- Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`) nao documentados
- `HealthCheckResponse` nao reflete formato enriquecido

## Plano de Execucao

### Passo 1 — docs/API_CONTAS_PAGAR.md (reescrever)
Regenerar completamente com:
- Secao "Idempotencia" com exemplos de `X-Idempotency-Key`
- Secao "Paginacao" com offset e cursor
- Secao "Envelope de Resposta" mostrando `meta`
- Rate limiting detalhado (120 API Key, 60 JWT)
- Todos os 30+ endpoints com request/response atualizados
- `/status` com formato enriquecido
- Versao 2.4.0

### Passo 2 — ApiDocumentation.tsx (atualizar Portal ERP)
- Adicionar `X-Idempotency-Key` na tabela de autenticacao/headers
- Corrigir rate limit de "60" para "120 (API Key) / 60 (JWT)"
- Adicionar "Idempotency Check" no FLOW de POST mutantes
- Adicionar param `cursor` nos endpoints `/query`, `/pagamentos`, `/parcelas`
- Atualizar response do `/status` com health check enriquecido
- Atualizar responses exemplos para incluir `meta` envelope
- Adicionar `filtrar_por_cpf_cnpj` no `/query`

### Passo 3 — SdkDownloadButtons.tsx (expandir SDK)
- Adicionar metodos: `cpConsultar`, `cpQuery`, `cpEstornar`, `cpRegistrarPagamento`, `cpGetPagamentos`, `cpGetParcelas`
- Adicionar suporte a idempotency key automatico em `_request` para POSTs
- Expandir `ListarParams` com todos os filtros
- Adicionar `QueryParams` type com cursor
- Adicionar types para `EstornarPayload`, `RegistrarPagamentoPayload`
- Aplicar mesmas mudancas nos 3 SDKs (TS, JS, Python)

### Passo 4 — OpenAPI Spec (atualizar schemas)
- Adicionar schema `MetaEnvelope` com `request_id`, `api_version`, `processed_at`, `duration_ms`
- Adicionar `x-idempotency-key` como header parameter nos POSTs
- Atualizar `HealthCheckResponse` para formato enriquecido
- Corrigir rate limit na descricao

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `docs/API_CONTAS_PAGAR.md` | Reescrever completo |
| `src/components/erp/ApiDocumentation.tsx` | Atualizar endpoints, flows, params, responses, auth info |
| `src/components/erp/SdkDownloadButtons.tsx` | Adicionar metodos, types, idempotency nos 3 SDKs |

## Impacto

- Documentacao e SDK passam a refletir 100% do que esta implementado
- Integradores veem idempotency, cursor pagination e envelope padronizado desde o primeiro contato
- OpenAPI exportavel fica correto para importar em Postman/Insomnia

