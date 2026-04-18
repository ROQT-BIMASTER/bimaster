

## Diagnóstico — estado real vs spec

Levantei o estado atual. Observações relevantes:

**SDKs (`SdkDownloadButtons.tsx`)** — `SDK_VERSION = "3.1.0"`. As 3 implementações (TS linhas ~851-1530, JS ~1662-2480, Python ~2890-3360) cobrem hoje os métodos canônicos do CP (`cpIncluir`, `cpUpsert`, `cpUpsertLote`, `cpQuery`, `cpConsultar`, `cpLancarPagamento`, `cpEstornar`, `cpCancelarLote`, `cpAnexos*`, `cpGetParcelas`, `cpParcelasSync`, `cpStatus`) — **mas zero métodos para a Export API e zero `cpUpdate`**.

**OpenAPI (gerado em `ApiDocumentation.tsx` linhas 1590-1745)** — `version: 4.1.0`. Os 10 endpoints da Export API existem como `endpoints[]` (`exportPull` e `exportAdvanced`), `/update` está em `cpEndpoints`. Tudo é varrido pelo gerador, então já têm path/operationId/tags. Falta validar exemplos como objeto JSON (vários só têm `body`/`response` como string template).

**`/listar` no contexto CP** — As linhas 1500-1520, 2451-2471 do SDK são smoke tests que usam `"GET /listar?a=1&b=2"` apenas como **chave arbitrária para testar normalização do cache LRU** (não um endpoint real chamado). Spec do usuário pede limpar; vou trocar por chave neutra `"/cnae-api/listar?a=1&b=2"` (lookup que existe e é REST) ou simplesmente `/foo?a=1&b=2`. Não há método `cpListar` no SDK (foi removido em v3.0.0).

**Export API real (`contas-pagar-export-api/index.ts`)** — Validei na Onda 4 que os 10 endpoints estão verdes (200/201). Roteamento: `/status`, `/pending`, `/paid`, `/cancelled`, `/export-batch`, `/confirm`, `/history`, `/export-summary`, `/reconciliation`, `/retry-failed`.

**Quick Start** — Comentário inline no SDK (~linhas 1429-1457 TS, 2408-2415 JS) lista 4 passos. Falta o passo 5 com Export API.

**Glossário** — Não existe bloco unificado. Vou criar comentário no topo de cada SDK + uma seção em `docs/API_CONTAS_PAGAR.md`.

**Versão** — Bump 3.1.0 → 3.2.0 (feature: 11 métodos novos).

## Plano — PR-16 (SDK 3.2.0 / OpenAPI 4.2.0 / APP 3.1.8)

### Fase A — SDK TypeScript (linhas 1078-1240)

1. Adicionar interfaces tipadas (após linha ~828, próximo a CpQueryResponse):
   ```
   CpExportStatusResponse, CpExportListResponse<T>, CpExportItem, CpExportPaidItem,
   CpExportCancelledItem, CpExportBatchResponse, CpExportConfirmResponse,
   CpExportHistoryItem, CpExportSummaryResponse, CpExportReconciliationResponse,
   CpExportRetryResponse, CpUpdatePayload
   ```
2. Adicionar 11 métodos na classe `HuggsERP` (após `cpAnexosListar`, antes do bloco CR):
   - `cpUpdate(body)` — `_validate({id})` + `PUT /contas-pagar-api/update`
   - `cpExportStatus()` — `GET /contas-pagar-export-api/status`
   - `cpExportPending(params?)` — `GET /pending`
   - `cpExportPaid(params?)` — `GET /paid`
   - `cpExportCancelled(params?)` — `GET /cancelled`
   - `cpExportBatch(body)` — `_validate({ids, export_type})` + `POST /export-batch`
   - `cpExportConfirm(body)` — `_validate({ids, export_type})` + `POST /confirm`
   - `cpExportHistory(params?)` — `GET /history`
   - `cpExportSummary(params?)` — `GET /export-summary`
   - `cpExportReconciliation(params?)` — `GET /reconciliation`
   - `cpExportRetryFailed(body)` — `_validate({ids})` + `POST /retry-failed`
3. Comentários "USE QUANDO/PREFIRA" acima de `cpIncluir` e `cpUpsert` (já existe parcialmente — completar conforme spec).
4. Trocar `/listar` por `/cnae-api/listar` nos smoke tests linhas 1500, 1505, 1511, 1519, 1520.
5. Adicionar passo 5 no Quick Start (linhas ~1429-1445).
6. Adicionar bloco "GLOSSÁRIO SDK→BANCO" em comentário no topo do TS.

### Fase B — SDK JavaScript (linhas 1872-2055)

Espelhar Fase A no JS sem types: 11 métodos `async`, mesmas validações, mesmos comentários. Atualizar smoke tests (2451-2471) e Quick Start (2408-2415).

### Fase C — SDK Python (linhas 3200-3355)

Espelhar com snake_case: `cp_update`, `cp_export_status`, `cp_export_pending`, `cp_export_paid`, `cp_export_cancelled`, `cp_export_batch`, `cp_export_confirm`, `cp_export_history`, `cp_export_summary`, `cp_export_reconciliation`, `cp_export_retry_failed`. Usar `_validate([...])` no padrão dos métodos existentes. TypedDicts para os retornos.

### Fase D — OpenAPI 4.2.0 (`ApiDocumentation.tsx`)

1. Bump `version: "4.1.0"` → `"4.2.0"` (linha 1745).
2. Para cada endpoint export em `exportPull`/`exportAdvanced` (linhas 205-219) garantir `response` (alguns só têm `body`). Já têm path/method/description; gerador adiciona tag/operationId automaticamente.
3. Garantir que `/update` em `cpEndpoints` (linha 133) tenha `body` e `response` definidos.

### Fase E — Versionamento + regression + memória + docs

- `SDK_VERSION = "3.2.0"` (linha 6) + atualizar comentário de changelog (linha 17).
- `APP_VERSION` `3.1.7` → `3.1.8` em `src/lib/version.ts` com nota PR-16.
- 8 invariantes novos em `audit/regression-greps.sh`:
  - `cpExportStatus|cpExportPending|cpExportPaid|cpExportCancelled|cpExportBatch|cpExportConfirm|cpExportHistory|cpExportSummary|cpExportReconciliation|cpExportRetryFailed` ≥30 (10 × 3 SDKs).
  - `cp_export_status|cp_export_pending|...` ≥10 (Python).
  - `cpUpdate` ≥3 (TS+JS+Python `cp_update`).
  - `SDK_VERSION = "3.2` ≥1.
  - OpenAPI `version: "4.2.0"` ≥1.
  - `APP_VERSION 3.1.8+` ≥1.
  - Sem `cpListar` reaparecendo (≤0).
  - `/contas-pagar-api/listar` em SDKs ≤0 (smoke usa `/cnae-api/listar`).
- Atualizar `docs/SDK_COVERAGE_MATRIX.md`: seção Export passa de 0% para 100% (10/10).
- Atualizar `docs/API_CONTAS_PAGAR.md` com glossário SDK→banco e bloco Export API.
- Atualizar `mem://process/release-changelog-discipline` se faltar referência ao bump 3.2.0.
- Adicionar entry no Changelog inline do `ApiDocumentation.tsx` (linha ~3574) — mandatory por `release-changelog-discipline`.

### Fase F — Validação E2E via SDK simulado

Como os SDKs são distribuídos como string template (não executados em runtime do app), o smoke test será via `supabase--curl_edge_functions` reproduzindo exatamente o que cada novo método chamaria:
1. `GET /contas-pagar-export-api/status` → 200.
2. `GET /pending?limit=2` → 200.
3. `POST /export-batch {ids, export_type:'registration'}` → 200.
4. `POST /confirm {ids, export_type:'registration'}` → 200 confirmed.
5. `GET /history?limit=5` → 200 com itens confirmados.
6. `PUT /contas-pagar-api/update {id, observacao:'pr-16 e2e'}` → 200.
7. `POST /retry-failed {ids:[]}` → 200.
8. Rodar `bash audit/regression-greps.sh` → todos os 50+ invariantes verdes.

## Não-escopo

- Mexer em `ContasAPagar.tsx` e telas listadas (regra fixa).
- Adicionar Export API ao SDK do CR (não pedido).
- Migrar Huggs_API_Collection.xlsx (binário, fora do controle do repo — nota documental apenas).
- Mudar HTTP status (201/200) — apenas documentar.

## Impacto

4 arquivos editados (`SdkDownloadButtons.tsx`, `ApiDocumentation.tsx`, `src/lib/version.ts`, `audit/regression-greps.sh`) + 2 docs (`SDK_COVERAGE_MATRIX.md`, `API_CONTAS_PAGAR.md`) + 1 update memória. ~400 linhas adicionadas (3 × 11 métodos + interfaces + comentários). 8 invariantes novos. Bump minor (3.1.0 → 3.2.0) — sem breaking, só adição. Risco: muito baixo (todos os endpoints já validados verdes na Onda 4).

