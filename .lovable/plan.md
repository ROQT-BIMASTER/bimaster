

## Diagnóstico — auditoria está 100% correta + descoberta extra

Validei runtime e código:

### Item 1 — CRÍTICO confirmado (CENÁRIO B + extra)
- `supabase/functions/contas-pagar-api/index.ts` registra **apenas** `'cancelar:POST'` (linha 181). Não existe `/cancelar-lote`.
- `handleCancelar` (`_shared/contas-pagar/crud-handlers.ts` linhas 162-216) **já é o handler de batch**: aceita `{ id?, ids?, motivo }`, devolve `{ success, cancelados, ids, bloqueados[] }` — exatamente o shape que os 3 SDKs esperam.
- **Os 3 SDKs estão quebrados em produção** apontando para `/cancelar-lote` (404). O "PR-17 fix" foi regressão. JS/Python já estavam corretos com `/cancelar` antes da onda anterior — confirmar nas linhas 2482 e 3675 (estão erradas também hoje). 
- O changelog do PR-17 (linha 18 do SDK e linha 3585 do `ApiDocumentation.tsx`) afirma "JS/Python já corretos" — falso. Estão **todos** apontando para `/cancelar-lote`.

**Decisão**: criar **alias `/cancelar-lote` no router** (1 linha: adicionar `'cancelar-lote:POST': handleCancelar` ao mapa de rotas). Mantém SDK funcionando + documenta os dois paths no OpenAPI. Custo zero, risco zero, sem mudança de SDK.

### Item 2 — `/check` e `/sync` JÁ EXISTEM
`erp-fornecedores-sync/index.ts` linhas 70 e 165: rotas `/check` e `/sync` são reais e funcionam. Falta só documentar no OpenAPI. (Changelog PR-17 mentiu: disse "5 documentados", só 3 entraram.)

### Item 3 — Trailing slash
7 endpoints com `path: "/"` (raízes de módulo) geram `/contas-correntes-api/`, `/erp-plano-contas-api/`, `/erp-portadores-api/`, `/erp-fornecedores-query/`, `/lancamentos-cc-api/`, `/contas-correntes-api/` e webhook `/erp-webhook-callbacks/`. Fix no gerador (linha 1605): trim trailing `/` quando `ep.path === "/"`.

### Item 4 — Changelog mente
"5 endpoints" no changelog v3.2.1 — entrarão de fato 5 só após este PR (3 CR já entraram + 2 fornecedores neste PR). Atualizar texto.

## Plano — PR-18 (SDK 3.2.2 / OpenAPI 4.3.1 / APP 3.1.10)

### Fase 1 — Alias `/cancelar-lote` no backend (1 linha)
`supabase/functions/contas-pagar-api/index.ts` ~linha 182: adicionar
```ts
'cancelar-lote:POST': handleCancelar,  // PR-18: alias para SDK v3.2.x — handleCancelar já é batch-aware
```
Adicionar também `cancelar-lote:POST` ao `CP_IDEMPOTENT_ROUTES` (linha 26).

### Fase 2 — OpenAPI v4.3.1 (`ApiDocumentation.tsx`)
1. **Trailing slash fix** (linha 1605): 
   ```ts
   const fullPath = ep.path === "/" ? api.basePath : `${api.basePath}${ep.path}`;
   ```
2. **Documentar `/cancelar-lote`** em `cpEndpoints` (após linha 139): novo endpoint POST `/cancelar-lote` com mesma semântica de `/cancelar` + summary "Alias batch-explícito para `/cancelar`".
3. **Documentar `fornecedoresCheck` e `fornecedoresSync`** em `fornecedoresSyncCrud` (após linha 461): adicionar `{ method: "POST", path: "/check", ... }` e `{ method: "POST", path: "/sync", ... }` com body/response reais.
4. Bump `version: "4.3.0"` → `"4.3.1"` (linha 1754).

### Fase 3 — Versionamento + changelog
- `SDK_VERSION = "3.2.2"` em `SdkDownloadButtons.tsx` linha 6 (apenas comentário/string — sem mudança de código de SDK; bump indica disclaimer atualizado).
- Atualizar changelog header (linhas 17-25): substituir bloco PR-17 por PR-18 com correção honesta.
- `APP_VERSION = '3.1.10'` em `src/lib/version.ts` com nota PR-18.
- Adicionar entry em `ApiDocumentation.tsx` Changelog inline (após linha 3584): bloco v4.3.1 / SDK 3.2.2 / APP 3.1.10 explicando o alias + documentação.

### Fase 4 — Regression
`audit/regression-greps.sh` — atualizar bloco PR-17 (linhas 191-196) e adicionar 4 invariantes:
- `'cancelar-lote:POST'` ≥1 em `contas-pagar-api/index.ts` (alias presente).
- `path: "/check"` e `path: "/sync"` em `fornecedoresSyncCrud` ≥2 (OpenAPI documenta).
- `version: "4.3.1"` ≥1.
- Trailing slash fix: `ep.path === "/" ? api.basePath` ≥1.
- Manter o invariante de `/cancelar-lote` em SDKs ≥3 (continuam apontando lá — agora válido).

### Fase 5 — Smoke E2E
1. `POST /contas-pagar-api/cancelar-lote` com `{ids:["uuid-fake"],motivo:"smoke"}` → 200 com `bloqueados:[{motivo:"Título não encontrado"}]` (era 404).
2. `POST /erp-fornecedores-sync/check` com `{cnpj:"03260554000116"}` → 200.
3. `bash audit/regression-greps.sh` → todos verdes.

## Não-escopo
- Não mexer em SDK methods (paths já corretos após alias).
- Não renomear `cpCancelarLote` (semântica do nome bate com o uso real).
- Não tocar handlers internos (alias é puro routing).

## Impacto
**4 arquivos**: `contas-pagar-api/index.ts` (+2 linhas alias+idempotency), `ApiDocumentation.tsx` (+3 endpoints, fix gerador, changelog, version), `SdkDownloadButtons.tsx` (header changelog + SDK_VERSION), `version.ts` (APP_VERSION + nota), `audit/regression-greps.sh` (+4 invariantes). Risco: muito baixo — alias backend é additive, OpenAPI/changelog é documental.

