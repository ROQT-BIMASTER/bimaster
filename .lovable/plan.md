

## Diagnóstico — auditoria externa confere

Validei cada item contra o estado real:

### Bug crítico do TS (item 1) — CONFIRMADO
`SdkDownloadButtons.tsx` linhas 1288-1289 do TS chamam `/contas-pagar-api/cancelar` (singular). JS (linhas 2470-2471) e Python (linha 3662) já estão corretos com `/cancelar-lote`. Fix isolado de 2 linhas.

### Endpoints órfãos no OpenAPI (item 2) — CONFIRMADO + descoberta crítica
Cruzei cada endpoint listado:

| Item | Existe no OpenAPI? | Existe como Edge Function? |
|---|---|---|
| 2a `GET /contas-correntes-api` | **SIM** (linha 222 `path: "/"`) | sim |
| 2b `GET /contas-receber-api/parcelas` | NÃO | **NÃO existe a rota** |
| 2c `GET /contas-receber-api/query` | NÃO | **NÃO existe a rota** |
| 2d `GET /contas-receber-api/recebimentos` | NÃO | **NÃO existe a rota** |
| 2e `GET /erp-fornecedores-query` | **SIM** (linha 453 `path: "/"`) | sim |
| 2f `GET /erp-plano-contas-api` | **SIM** (linha 464 `path: "/"`) | sim |
| 2g `GET /erp-portadores-api` | **SIM** (linha 468 `path: "/"`) | sim |
| 2h `POST /erp-fornecedores-sync/check` | NÃO (existe `/consultar`) | precisa verificar |
| 2i `POST /erp-fornecedores-sync/sync` | NÃO (existe `/sync-bidirecional`) | precisa verificar |
| 2j `POST /contas-pagar-api/cancelar-lote` | precisa verificar | sim (validado nas Ondas) |

**Descoberta grave**: os SDKs (TS/JS/Python) chamam `crQuery`, `crGetParcelas`, `crGetRecebimentos` mas essas rotas **não existem** no `contas-receber-api/index.ts`. Em produção o dev externo recebe 404. Isso é maior do que "documentar no OpenAPI" — exige criar os handlers reais.

### Item 3 (cp_anexos_listar Python) — CONFIRMADO
Linha 3635 usa `self._request("GET", path)` em vez de `_cp_dispatch`. Fix de 1 linha.

### Item 4 (simetria CP/CR) — depende do item 2b/c/d
Mesma descoberta: criar primeiro as rotas reais.

### Item 5 (operationId camelCase) — JÁ ESTÁ camelCase
O gerador `toOperationId` (linhas 1483-1501) sempre produz camelCase com prefixo curto (`cp`, `cr`, `cc`, `fornecedoresSync`, `fornecedoresQuery`, `lancCC`, etc.). Nunca produz `contas_pagar_exportConfirm`. A auditoria externa olhou versão mais antiga ou outra fonte. Vou apenas reforçar com 1 invariante grep.

## Plano — PR-17 (SDK 3.2.1 / OpenAPI 4.3.0 / APP 3.1.9)

### Fase 1 — Bug crítico TS (item 1)
`SdkDownloadButtons.tsx` linhas 1288-1289: trocar `/contas-pagar-api/cancelar` por `/contas-pagar-api/cancelar-lote` (2 ocorrências). Bumpa SDK_VERSION para `3.2.1`.

### Fase 2 — Paridade Python (item 3)
Linha 3635: trocar `self._request("GET", path)` por `self._cp_dispatch("GET", path, None, retry=False, idempotency_key=None)`.

### Fase 3 — Criar handlers REAIS no `contas-receber-api/index.ts`
Antes de documentar no OpenAPI, criar os 3 endpoints que os SDKs chamam mas retornam 404 hoje:

- **`GET /contas-receber-api/query`**: cópia da lógica de `cpQuery` (filtros por status/empresa/limite/offset/cursor) → SELECT em `contas_receber`. Retorna `{ data, pagination }`.
- **`GET /contas-receber-api/parcelas`**: query param `conta_receber_id` (uuid) → SELECT `cr_parcelas` (criar tabela se não existir? confirmar com usuário) ou retornar `[]` se ainda não há tabela. **CHECAR**: olhar se `cr_parcelas` existe; se não, retornar `{data:[],pagination:{...}}` e documentar como “estrutura preparada, sem dados em CR — usar /upsert para parcelas internas”.
- **`GET /contas-receber-api/recebimentos`**: query param `conta_receber_id` (uuid) → SELECT na tabela existente de baixas/recebimentos (provavelmente `recebimentos` ou `pagamentos_recebidos`). Confirmar tabela real.

### Fase 4 — Adicionar endpoints faltantes no OpenAPI
Em `ApiDocumentation.tsx`:
- Adicionar 3 endpoints novos no array `contasReceberIntegracao`: `/query`, `/parcelas`, `/recebimentos`.
- Adicionar mapeamento em `PATH_SCHEMA_MAP` (linha ~1393) com `req`/`res` apropriados.
- Adicionar 2 endpoints no array `fornecedoresSyncCrud`: `/check` (alias de `/consultar`?) e `/sync` (alias de `/sync-bidirecional`?). **DECISÃO**: documentar somente os paths que existem de verdade — se SDK chama `/check`/`/sync`, mudamos para chamar `/consultar`/`/sync-bidirecional` (que já existem) OU criamos aliases na edge function. Vou propor **criar aliases** (linhas finas no roteador) para não quebrar SDK existente.
- Bump `version: "4.2.0"` → `"4.3.0"` (linha 1745).

### Fase 5 — Versionamento + regression + docs
- `SDK_VERSION = "3.2.1"` + comentário PR-17 (changelog inline).
- `APP_VERSION` `3.1.8` → `3.1.9` em `src/lib/version.ts`.
- 6 invariantes novos em `audit/regression-greps.sh`:
  - `/contas-pagar-api/cancelar"` (sem `-lote`) ≤0 no TS.
  - `/contas-pagar-api/cancelar-lote` ≥3 (TS+JS+Python).
  - `crQuery|crGetParcelas|crGetRecebimentos` ≥3 no `ApiDocumentation.tsx` (paths array).
  - Handlers reais: `endsWith\('/query'\)` ≥1 em `contas-receber-api/index.ts`.
  - `cp_anexos_listar` usa `_cp_dispatch` (não `_request`).
  - `OpenAPI version: "4.3` ≥1.
- Atualizar `docs/API_CONTAS_RECEBER.md` com `/query`, `/parcelas`, `/recebimentos`.
- Atualizar inline Changelog em `ApiDocumentation.tsx` (mandatory por `release-changelog-discipline`).
- Atualizar memória `mem://finance/receivable-status-and-sync-governance` com paridade CP/CR.

### Fase 6 — Smoke E2E via curl_edge_functions
1. `GET /contas-receber-api/query?limit=2` → 200 com array.
2. `GET /contas-receber-api/parcelas?conta_receber_id=<uuid>` → 200.
3. `GET /contas-receber-api/recebimentos?conta_receber_id=<uuid>` → 200.
4. `bash audit/regression-greps.sh` → 100% verde.

## Decisões que preciso confirmar

Vou perguntar antes de implementar — itens 2h/2i e parcelas CR têm caminhos divergentes.

<lov-actions>
<lov-suggestion message="Aprovado — execute o plano completo: fix do TS, criar handlers reais CR (/query, /parcelas, /recebimentos), aliases /check e /sync em fornecedores-sync, atualizar OpenAPI v4.3.0 e SDK v3.2.1.">Aprovar plano completo</lov-suggestion>
<lov-suggestion message="Apenas bugfix do cpCancelarLote no TS + paridade cp_anexos_listar no Python + bump SDK 3.2.1. Adiar criação de handlers CR e endpoints fornecedores para próximo PR.">Só os 2 bugfixes críticos agora</lov-suggestion>
<lov-suggestion message="Em vez de criar handlers reais para /query, /parcelas, /recebimentos no CR, remova esses métodos dos SDKs (TS/JS/Python) já que não há rotas correspondentes em produção.">Remover métodos órfãos dos SDKs</lov-suggestion>
<lov-suggestion message="Antes de executar, valide com curl quais rotas dos SDKs realmente retornam 404 hoje (crQuery, crGetParcelas, crGetRecebimentos, fornecedoresSync /check e /sync) e me mostre o resultado.">Validar 404s antes de codar</lov-suggestion>
</lov-actions>

