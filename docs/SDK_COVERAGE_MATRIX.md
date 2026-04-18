# SDK Coverage Matrix — OpenAPI v4.1.0 ↔ SDK v3.1.0

Mapeamento dos 185 endpoints OpenAPI para os ~52-67 métodos SDK por linguagem.
Decisão de cobertura é deliberada: **fluxos financeiros críticos têm método tipado;
lookups e cadastros raramente mutáveis usam REST direto**.

Convenções: `✓` = método dedicado nas 3 linguagens (TS/JS/PY) | `REST` = consumir via `_request` direto | `INT` = endpoint interno (sem cobertura SDK por design).

## 1. Financeiro Core — Cobertura 100% (TS/JS/PY)

| Endpoint OpenAPI | Método SDK | Cobertura |
|---|---|---|
| `POST /contas-pagar-api/upsert` | `cpUpsert` / `cp_upsert` | ✓ |
| `POST /contas-pagar-api/upsert-lote` | `cpUpsertLote` | ✓ |
| `GET /contas-pagar-api/query` | `cpQuery` | ✓ |
| `GET /contas-pagar-api/consultar` | `cpConsultar` | ✓ |
| `POST /contas-pagar-api/lancar-pagamento` | `cpLancarPagamento` | ✓ |
| `POST /contas-pagar-api/estornar` | `cpEstornar` | ✓ |
| `GET /contas-pagar-api/parcelas` | `cpGetParcelas` | ✓ |
| `POST /contas-pagar-api/parcelas/sync` | `cpParcelasSync` | ✓ |
| `GET/POST /contas-pagar-api/anexos` | `cpAnexos*` | ✓ |
| `POST /contas-pagar-api/cancelar` | `cpCancelarLote` | ✓ |
| `GET /contas-pagar-api/status` | `cpStatus` | ✓ |
| `POST /contas-receber-api/upsert` | `crUpsert` | ✓ |
| `POST /contas-receber-api/upsert-lote` | `crUpsertLote` | ✓ |
| `GET /contas-receber-api/query` | `crQuery` | ✓ |
| `GET /contas-receber-api/consultar` | `crConsultar` | ✓ |
| `POST /contas-receber-api/lancar-recebimento` | `crLancarRecebimento` | ✓ |
| `GET /contas-receber-api/parcelas` | `crGetParcelas` | ✓ |
| `GET /contas-receber-api/recebimentos` | `crGetRecebimentos` | ✓ |
| `GET /contas-receber-api/status` | `crStatus` | ✓ |

**Cobertura: 19/19 (100%)**

## 2. Cadastros Base — Cobertura Parcial (operações principais)

| Endpoint | Método SDK | Cobertura |
|---|---|---|
| `clientes-api/{incluir,listar,consultar,alterar}` | `clientes*` | ✓ |
| `fornecedores-api/{incluir,listar,consultar,alterar}` | `fornecedores*` | ✓ |
| `empresas-api/{incluir,listar,consultar,alterar}` | `empresas*` | ✓ |
| `categorias-api/{incluir,listar}` | `categorias*` | ✓ |
| `boletos-api/{listar,consultar}` | `boletos*` | ✓ |
| `contas-correntes-api/*` | `contasCorrentes*` | ✓ |

**Cobertura: ~20 endpoints / ~35 (57%)**. Métodos auxiliares (excluir, sync detalhado) via REST direto.

## 3. Lookups Read-Only — REST Direto (decisão de produto)

São endpoints `/listar` simples, raramente mutáveis. Justificativa: peso baixo de DX (uma linha `await erp._request("GET", "/cnae-api/listar")` resolve), evita inflar SDK com 60+ métodos triviais.

| Endpoint | Acesso |
|---|---|
| `bancos-api/listar` | REST |
| `bandeiras-api/listar` | REST |
| `cidades-api/listar` | REST |
| `paises-api/listar` | REST |
| `cnae-api/listar` | REST |
| `tipos-anexo-api/listar` | REST |
| `tipos-atividade-api/listar` | REST |
| `tipos-documento-api/listar` | REST |
| `tipos-entrega-api/listar` | REST |
| `finalidades-transferencia-api/listar` | REST |
| `origens-api/listar` | REST |
| `departamentos-api/listar` | REST |
| `centros-custo` (consulta direta DB) | REST |
| `dre-cadastro-api/*` | REST |

**~28 endpoints via REST direto** — todos retornam `{ items: [...], paginacao: {...} }`.

## 4. Webhooks

| Endpoint | Método SDK | Cobertura |
|---|---|---|
| `POST /webhook-subscriptions-api/subscribe` | `webhookSubscribe` | ✓ |
| `DELETE /webhook-subscriptions-api/unsubscribe` | `webhookUnsubscribe` | ✓ |
| `GET /webhook-subscriptions-api/list` | `webhookList` | ✓ |
| `webhook-dispatcher` (interno) | — | INT |
| **Validação HMAC** | `verifyWebhookSignature` (v3.1.0) | ✓ |

## 5. ERP Integration

| Endpoint | Método SDK | Cobertura |
|---|---|---|
| `erp-export-payment` | `erpExportPayment` | ✓ |
| `erp-fornecedores-query` | `erpFornecedoresQuery` | ✓ |
| `erp-fornecedores-sync` | `erpFornecedoresSync` | ✓ |
| `erp-portadores-api/*` | — | REST |
| `erp-plano-contas-api/*` | — | REST |
| `erp-webhook-inbound` | — | INT |

## 5b. Contas a Pagar — Export API (PR-16, v3.2.0) — Cobertura 100%

Workflow ERP → Huggs: listar pendentes, exportar lote, confirmar recebimento, reconciliar, reprocessar erros.

| Endpoint | Método SDK (TS/JS) | Método SDK (PY) |
|---|---|---|
| `GET /contas-pagar-export-api/status` | `cpExportStatus` | `cp_export_status` |
| `GET /contas-pagar-export-api/pending` | `cpExportPending` | `cp_export_pending` |
| `GET /contas-pagar-export-api/paid` | `cpExportPaid` | `cp_export_paid` |
| `GET /contas-pagar-export-api/cancelled` | `cpExportCancelled` | `cp_export_cancelled` |
| `POST /contas-pagar-export-api/export-batch` | `cpExportBatch` | `cp_export_batch` |
| `POST /contas-pagar-export-api/confirm` | `cpExportConfirm` | `cp_export_confirm` |
| `GET /contas-pagar-export-api/history` | `cpExportHistory` | `cp_export_history` |
| `GET /contas-pagar-export-api/export-summary` | `cpExportSummary` | `cp_export_summary` |
| `GET /contas-pagar-export-api/reconciliation` | `cpExportReconciliation` | `cp_export_reconciliation` |
| `POST /contas-pagar-export-api/retry-failed` | `cpExportRetryFailed` | `cp_export_retry_failed` |
| `PUT /contas-pagar-api/update` | `cpUpdate` | `cp_update` |

**Cobertura: 11/11 (100%)** — todos com `_validate()` em endpoints que recebem body.

## 6. Auxiliares Financeiros

| Endpoint | Acesso |
|---|---|
| `parcelas-api/*` | REST (uso direto incomum) |
| `movimentos-financeiros-api/*` | REST |
| `lancamentos-cc-api/*` | REST |
| `pesquisar-lancamentos-api/*` | REST |
| `resumo-financeiro-api/*` | REST |
| `orcamentos-caixa-api/*` | REST |
| `anexos-api/*` (genérico) | REST (use `cpAnexos*` para CP) |
| `projetos-api/*` | REST |
| `api-health-check` | INT (admin) |

---

## Resumo executivo

| Categoria | Endpoints | Cobertura SDK | Justificativa |
|---|---:|---:|---|
| Financeiro core | 19 | 100% | Operações críticas, idempotência obrigatória |
| CP Export API + cpUpdate | 11 | 100% | PR-16 — workflow ERP completo |
| Cadastros base | 35 | 57% | CRUD principal coberto; helpers via REST |
| Lookups read-only | 28 | 0% (REST) | Triviais, peso DX baixo |
| Webhooks | 4 | 75% + HMAC helper | Dispatcher é interno |
| ERP integration | 6 | 50% | Núcleo coberto; portadores/plano via REST |
| Auxiliares | ~92 | 0% (REST) | Uso esporádico, REST suficiente |
| **Total** | **195** | **~63 métodos / 32%** | Foco deliberado em fluxos críticos |


## Como usar endpoints sem método SDK

```ts
// Todos os SDKs expõem o método interno _request:
const cnaes = await erp._request("GET", "/cnae-api/listar?registros_por_pagina=50");
const exec  = await erp._request("POST", "/erp-portadores-api/sync", { force: true });
```

`_request` aplica automaticamente: x-api-key, X-Idempotency-Key (POST/PUT), ETag/If-None-Match,
captura de RateLimit-* e X-Request-ID, e raise tipado das classes `HuggsAPIError`.

## Convenções de versionamento

- Bump **minor** (3.1 → 3.2): adição de método novo sem breaking.
- Bump **major** (3 → 4): remoção/renomeação de método (sempre via PR-7-style cleanup pré-prod).
- Cobertura sempre testada via `audit/regression-greps.sh` (43 invariantes).
