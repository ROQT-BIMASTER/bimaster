

# Correcao 9 — Adicionar /status aos Endpoints CP e CR

## Problema

O SDK define `cpStatus()` e `healthCheck()` que chamam `GET /contas-pagar-api/status`, mas esse endpoint nao esta documentado no OpenAPI. O mesmo ocorre para CR (`/contas-receber-api/status`).

Outras APIs (contas-correntes, lancamentos-cc, boletos, anexos) ja possuem `{ method: "GET", path: "/status", description: "Health check da API", flow: FLOW.status }`.

## Alteracoes

**Arquivo: `src/components/erp/ApiDocumentation.tsx`**

### 1. Adicionar `/status` ao final de `contasPagarCrud` (linha 138, antes do `];`)

```typescript
  { method: "GET", path: "/status", description: "Health check da API de Contas a Pagar", flow: FLOW.status, response: `{ "status": "ok", "version": "2.4.0", "timestamp": "2026-04-14T00:00:00Z" }` },
```

### 2. Adicionar `/status` ao final de `contasReceberIntegracao` (linha 282, antes do `];`)

```typescript
  { method: "GET", path: "/status", description: "Health check da API de Contas a Receber", flow: FLOW.status, response: `{ "status": "ok", "version": "2.4.0", "timestamp": "2026-04-14T00:00:00Z" }` },
```

O gerador OpenAPI ja faz o mapeamento automatico: endpoints com path `/status` recebem schema `HealthCheckResponse` (linha 1624). Nenhuma outra alteracao necessaria.

## Resumo

- 2 endpoints adicionados (1 em CP, 1 em CR)
- Seguem o mesmo padrao das outras APIs
- Response explicito para garantir exemplo correto no Swagger UI

