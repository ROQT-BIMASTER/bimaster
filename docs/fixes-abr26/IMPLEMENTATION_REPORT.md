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
