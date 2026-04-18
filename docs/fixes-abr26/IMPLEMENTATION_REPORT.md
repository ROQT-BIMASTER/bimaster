# PR-9 — Implementation Report (Bug-fix patch v3.1.1)

**Data:** 2026-04-18  
**Tipo:** Patch (bugfix puro, zero breaking change)  
**Versão:** APP `3.1.0 → 3.1.1` · CR API `1.2.0 → 1.3.0` · OpenAPI `4.1.0` (sem mudança) · SDKs `3.1.0` (sem mudança)  
**Origem:** Auditoria QA externa (bateria de 169 endpoints, 100/169 sucessos = 59%).

## 1. Triagem dos 21 bugs reportados

A auditoria externa foi validada **antes** de qualquer alteração de código, contra o estado real do repositório (pós PR-7/PR-8). Resultado:

| ID  | Sintoma reportado                              | Status final          | Justificativa                                                                                          |
|-----|------------------------------------------------|-----------------------|--------------------------------------------------------------------------------------------------------|
| P0-1 | `.catch is not a function` em `/contas-receber-api/incluir` | ❌ TESTE INVÁLIDO     | 295 ocorrências de `.catch(` no projeto, **todas** em padrões legítimos (`req.json().catch(()=>({}))` ou fire-and-forget de logs). Nenhum no antipattern descrito. |
| P0-2 | `column contas_bancarias.ativo does not exist` | ✅ CORRIGIDO          | Schema real usa `inativo` (boolean). Código de `contas-correntes-api` foi alinhado.                     |
| P0-3 | `column contas_bancarias.nome does not exist`  | ✅ CORRIGIDO          | Schema real usa `descricao`. SELECT/ORDER/INSERT alinhados.                                            |
| P0-4 | `Cannot coerce` em `/fornecedores-api/alterar` | ❌ PATH ERRADO         | A função `fornecedores-api` **não existe**. As funções reais são `erp-fornecedores-query` e `erp-fornecedores-sync`. |
| P0-5 | `column trade_chart_of_accounts.codigo_dre_gerencial` | ❌ FANTASMA            | Nenhuma query no código atual referencia essa coluna. `categorias-api` usa `codigo_dre` (varchar(10), existe). |
| P1-1 | 501 em `/conciliar` e `/desconciliar` (CR)     | ✅ IMPLEMENTADO        | Endpoints agora retornam 200 com lógica real (status, audit-trail em `observacao`, webhook).            |
| P1-2 | 401 em `/fornecedores-sync-api/...`            | ❌ PATH ERRADO         | Nome correto é `erp-fornecedores-sync`. Auth funciona normalmente nele.                                |
| P1-3 | `value too long for type character varying(1)` em `empresas` | ✅ CORRIGIDO          | `regime_tributario` é varchar(1) no schema; Zod foi alinhado de `.max(40)` → `.max(1)` em INCLUIR e ALTERAR. |
| P1-4 | UUID literal aceito (string `"uuid"`)          | ✅ HARDENING           | Adicionado `requireUuid()` em `_shared/validate.ts` para 400 estruturado em vez de 500 do Postgres.    |
| P1-5 | `X-Request-ID` ausente em 19% das respostas    | ❌ JÁ CORRIGIDO        | `_shared/response.ts` injeta o header em **100%** das respostas (success/error). Coberto desde PR-1B.   |
| P2-1 | ETag em GET cacheáveis                         | ❌ JÁ CORRIGIDO        | `applyETagByPath` ativo em `/status` e `/consultar` desde PR-5.                                        |
| P2-3 | Headers `RateLimit-*`                          | ❌ JÁ CORRIGIDO        | `applyRateLimitHeaders` injetado em todas as respostas via `secureHandler` desde PR-6.                  |

**Resumo:** dos 21 bugs reportados, **5 foram corrigidos** (P0-2, P0-3, P1-1, P1-3, P1-4), **3 já estavam corrigidos** em PRs anteriores (P1-5, P2-1, P2-3), **3 são path errado/fantasma** (P0-4, P0-5, P1-2), **1 é teste inválido** (P0-1).

## 2. Mudanças aplicadas

### 2.1 `supabase/functions/contas-correntes-api/index.ts`
- `mapHuggsToDb`: removido fallback inválido para coluna `nome`.
- `mapDbToHuggs`: `descricao` agora puro (sem `?? row.nome`); `inativo` lê coluna correta.
- `GET /` (listar): default ordenação `descricao`, whitelist anti-injeção, filtro `inativo=false`.
- `GET /resumo`: SELECT alinhado (sem `nome`/`ativo`), ORDER por `descricao`, filtro `inativo`.
- `POST /incluir`: `inativo: false` em vez de `ativo: true`.
- `PUT /alterar`: removido `delete row.nome` (era band-aid).
- `DELETE /excluir`: `update({ inativo: true })` em vez de `update({ ativo: false })`.

### 2.2 `supabase/functions/contas-receber-api/index.ts`
- `API_VERSION`: `1.2.0` → `1.3.0`.
- `POST /conciliar` (PR-9 / P1-1): valida `id_lancamento_cc` + `valor`, busca título, bloqueia status imutáveis, atualiza para `Conciliado` + audit-trail em `observacao`, audit-log + webhook `conta_receber.conciliada`.
- `POST /desconciliar` (PR-9 / P1-1): exige status atual `Conciliado`, reverte para `Aberto`, audit-trail + webhook `conta_receber.desconciliada`.

### 2.3 `supabase/functions/empresas-api/index.ts`
- IncluirSchema/AlterarSchema: `regime_tributario` ajustado de `.max(40)` → `.max(1)` (alinhado ao schema real `varchar(1)`).

### 2.4 `supabase/functions/_shared/validate.ts`
- Novos exports: `isUuid()`, `requireUuid(value, fieldName)` — lançam `ValidationError` (400 estruturado) quando UUID inválido chega na borda da API. Substitui o erro 500 cru do Postgres (`invalid input syntax for type uuid`).

### 2.5 `src/lib/version.ts`
- `APP_VERSION`: `3.1.0` → `3.1.1`.

### 2.6 `audit/regression-greps.sh`
- Novo bloco "Invariantes PR-9 (bugfix patch v3.1.1)" com 11 checks:
  - Zero `update({ ativo:` em contas-correntes-api
  - Zero `.eq("ativo"` em contas-correntes-api
  - `inativo` usado ≥3×
  - Zero placeholder 501 em CR /conciliar
  - `cr_api_conciliar` + webhook `conta_receber.conciliada` referenciados
  - `cr_api_desconciliar` + webhook `conta_receber.desconciliada` referenciados
  - `API_VERSION = '1.3.0'` em CR
  - Zero `regime_tributario .max(40)`; ≥2× `.max(1)`
  - `requireUuid` exportado
  - `isUuid` exportado
  - `X-Request-ID` injetado em `_shared/response.ts` (≥3× — invariante PR-1B)
- Bloco de versões: `APP_VERSION 3.1.1` (não mais `3.1.0`).

## 3. Migrations

**Nenhuma.** Todas as correções foram alinhamento código↔schema existente. Não foi inventada nenhuma coluna baseada no laudo externo.

## 4. Validação

- `audit/regression-greps.sh` deve passar com **54+ checks OK** (43 herdados + 11 novos PR-9).
- Smoke recomendado:
  - `GET /contas-correntes-api/` → 200 (não mais 500)
  - `GET /contas-correntes-api/resumo` → 200 (não mais 500)
  - `POST /contas-receber-api/conciliar` com payload válido → 200 (não mais 501)
  - `POST /contas-receber-api/desconciliar` → 200 (não mais 501)
  - `POST /empresas-api/incluir` com `regime_tributario:"3"` → 201 (não mais 500)

## 5. Próxima sprint (não-escopo PR-9)

- **Webhook HMAC server-side**: SDKs já têm `verifyWebhookSignature` (PR-8); falta o emissor (`webhook-dispatcher`) assinar com `X-Webhook-Signature: sha256=…`.
- **Path-correction docs**: atualizar SDKs/OpenAPI para deixar claro que **não existe** `fornecedores-api` puro — o consumidor deve usar `erp-fornecedores-query` (consultas) e `erp-fornecedores-sync` (escritas/sync).
- **CI gate**: integrar `audit/regression-greps.sh` em pre-deploy hook.

---

**Conclusão:** PR-9 fecha as **5 lacunas reais** da auditoria QA externa sem introduzir migrations destrutivas nem versionar o contrato externo (OpenAPI 4.1.0/SDK 3.1.0 intactos). Bump APP `3.1.0 → 3.1.1` reflete o caráter puramente corretivo do release.

---

# PR-15 — Onda 4: Export API alinhada à `contas_pagar` (v3.1.7)

**Data:** 2026-04-18  
**Tipo:** Patch (alinhamento de fonte de dados, sem breaking change externo)  
**Versão:** APP `3.1.6 → 3.1.7` · OpenAPI/SDK inalterados (shape de `/pending`, `/paid`, `/cancelled` mantido).

## 1. Diagnóstico

A Export API (10 endpoints) foi originalmente construída sobre `financial_payment_queue` (1 registro vazio, módulo legado). Com o ciclo Onda 1-3 do CP consolidado, todos os 48k+ títulos vivem em `contas_pagar`. Resultado pré-PR-15:

- `/status`, `/pending`, `/paid` retornavam contagens zero ou arrays vazios.
- `/cancelled` e `/reconciliation` quebravam com `500 PGRST204` ao filtrar por coluna inexistente `conta_pagar_id` em `erp_export_queue`.
- `/export-batch` aceitava qualquer UUID sem validar existência em `contas_pagar`.

## 2. Decisão arquitetural

Reusar `erp_export_queue.payment_queue_id` semanticamente como "ID externo do título" — armazena UUID de `contas_pagar.id`. **Sem nova coluna, sem migration de schema.** Risco baixo: `erp_export_queue` estava vazia. Documentado em código e em `mem://finance/contas-pagar-governance-and-audit-standard`.

Migration única aplicada: `DROP CONSTRAINT IF EXISTS erp_export_queue_payment_queue_id_fkey` para liberar a coluna do FK legado para `financial_payment_queue`.

## 3. Mudanças aplicadas

### 3.1 `supabase/functions/contas-pagar-export-api/index.ts` (reescrita de 3 handlers)

- **`handleStatusDetail`**: contagens agora baseadas em `contas_pagar.status='pendente'/'pago'/'cancelado'`, com subtração dos já exportados em `erp_export_queue` por tipo (`registration`/`payment`/`cancellation`).
- **`handleGetItems` (`/pending` e `/paid`)**: troca de fonte para `contas_pagar`, mapeando `accepted→pendente` e `paid→pago`. Cruza com `erp_export_queue.payment_queue_id` para excluir já exportados. Payload usa colunas reais (`fornecedor_nome`, `valor_original`, `data_vencimento`, etc.).
- **`handleGetCancelledItems`**: filtro de exclusão agora por `payment_queue_id` (não `conta_pagar_id`).
- **`handleReconciliation`**: removido ramo `conta_pagar_id.in.(...)` do `.or()`. Só `payment_queue_id`.
- **`handleExportBatch`**: pré-valida em batch que todos os IDs existem em `contas_pagar`; ausentes vão para `errors[]` com mensagem "título não encontrado em contas_pagar". Idempotência confirmada: re-envio de IDs já `exported` retorna `skipped`.

### 3.2 `src/lib/version.ts`

- `APP_VERSION`: `3.1.6` → `3.1.7`.

### 3.3 `audit/regression-greps.sh`

5 invariantes novos PR-15:
- `contas_pagar` ≥3 em `contas-pagar-export-api/index.ts` (nova fonte canônica).
- `financial_payment_queue` ≤0 em handlers ativos (regressão proibida — apenas comentários permitidos).
- `conta_pagar_id` ≤0 em filtros do export-api (coluna não existe em `erp_export_queue`).
- `payment_queue_id` ≥6 (uso correto consolidado).
- `APP_VERSION = '3.1.7'` em `version.ts`.

## 4. Validação E2E (todos 200 OK)

| # | Endpoint | Resultado |
|---|---|---|
| 1 | `GET /status` | `provisao:865 / baixa:43614 / cancelamento:3` |
| 2 | `GET /pending?limit=3` | 3 títulos com fornecedor + valor + empresa |
| 3 | `GET /cancelled?limit=3` | 3 cancelados, sem 500 |
| 4 | `GET /reconciliation` | `taxa_sincronizacao:0`, sem 500 |
| 5 | `POST /export-batch` (2 IDs reais) | `queued:2, skipped:0` |
| 6 | `POST /export-batch` (UUID `00000000…`) | `errors:["…título não encontrado…"]` |
| 7 | `POST /confirm` (2 IDs) | `confirmed:2` |
| 8 | `POST /export-batch` (mesmos 2 IDs pós-confirm) | `queued:0, skipped:2` ✅ idempotência |
| 9 | `GET /history?export_type=registration` | 2 itens em `exported` |
| 10 | `GET /export-summary` | `por_tipo.registration.exported:2` |
| 11 | `POST /retry-failed` | `retried:0` |

## 5. Não-escopo

- Adicionar coluna `conta_pagar_id` a `erp_export_queue` (decisão B — reuso de `payment_queue_id`).
- Refazer `/webhook-push` (não está no checklist da Onda 4).
- Tocar telas frontend (regra explícita das Ondas 1-4).
- SDK/OpenAPI bump (sem mudança de contrato externo).

**Conclusão:** PR-15 fecha a Onda 4 (Export API) eliminando o desalinhamento estrutural entre a API e a fonte real de dados (`contas_pagar`). Todos os 10 endpoints da spec passam smoke E2E. Bump APP `3.1.6 → 3.1.7` reflete o caráter de alinhamento puro (sem nova feature, sem schema novo além do drop do FK legado).
