

# v2.14.0 / OpenAPI 3.8.0 — Fidelidade changelog↔código (8.5 → 9.0+)

## Diagnóstico

Parecer 8.5 (caiu de 9.4). Funcionalidade está completa, mas três itens anunciados na v2.11.0 estão em descompasso com o código entregue. Foco desta rodada: **fidelidade total entre o que o changelog afirma e o que o SDK faz em runtime**.

Gaps confirmados pelo revisor:
1. **Timeout dead code** — `CpRequestOptions.timeout` aceito em TS mas ignorado (hardcoded 30s em `_request`). Python sequer expõe o campo.
2. **Deprecation plan só na prosa** — nenhum `@deprecated` JSDoc / `warnings.warn` nos métodos marcados para v4.0.0.
3. **OpenAPI sem `deprecated:true`** nos paths legacy.
4. **Smoke test ausente** no distribuível.
5. **Resposta `/erp-export-payment/`** ainda como string escapada (cosmético).

## Escopo

### 1. Timeout configurável de verdade (+0.2)

**TypeScript** (`SdkDownloadButtons.tsx`):
- `_request(method, path, body?, idempotencyKey?, timeoutMs?)` aceita timeout.
- `setTimeout(..., timeoutMs ?? 30000)` em vez de hardcoded 30000.
- `_cpDispatch` / `_crDispatch` / `_requestWithRetry` lêem `opts.timeout` e propagam.

**Python**:
- `_cp_dispatch` e `_cr_dispatch` ganham parâmetro `timeout: Optional[int]`.
- `requests.request(..., timeout=timeout or 30)`.
- Métodos de lote (`cp_upsert_lote`, `cp_parcelas_sync`, `cr_upsert_lote`) expõem `timeout` como kwarg.

### 2. Deprecation real em código (+0.15)

**TS/JS** — `/** @deprecated since 2.14.0, removed in 4.0.0 (Q3 2026). Use {alternativa}. */` em:
- `cpAlterar` → `cpUpsert`
- `cpListar` → `cpQuery`
- `cpRegistrarPagamento` → `cpLancarPagamento`
- `cpCancelarPagamento` → `cpEstornar`
- `crAlterar`, `crListar`, `crRegistrarRecebimento`, `crCancelarRecebimento`

**Python** — no início de cada método deprecated:
```python
warnings.warn("cp_alterar deprecated desde 2.14.0, removido em 4.0.0. Use cp_upsert.",
              DeprecationWarning, stacklevel=2)
```

### 3. OpenAPI: `deprecated: true` + `x-sunset` (+0.05)

Em `ApiDocumentation.tsx`, nos 8 paths legacy (`/contas-pagar-api/alterar`, `/listar`, `/registrar-pagamento`, `/cancelar-pagamento` + equivalentes CR):
```json
{ "deprecated": true, "x-sunset": "2026-09-30",
  "x-deprecation-replacement": "/contas-pagar-api/upsert" }
```

### 4. Smoke test no distribuível (+0.1)

Novo `src/components/erp/__tests__/sdk-smoke.test.ts` com Vitest, cobrindo 5 invariantes (sem rede):
- Idempotência preservada (mesma key → mesmo header).
- `codigo_status ≠ "0"` levanta exception (mock fetch).
- URL encoding correto (espaço/acento).
- Validação local: `cpUpsertLote([])` rejeita; `cpParcelasSync(>5000)` rejeita.
- Timeout propagado: spy em `setTimeout` confirma `opts.timeout` chega ao AbortController.

### 5. Resposta JSON real definitiva em `/erp-export-payment/` (+0.05)

Buscar **todas** ocorrências em `ApiDocumentation.tsx` e substituir qualquer `example` em string escapada por objeto JSON estruturado (action `export` e `status`).

### 6. Disciplina de changelog

Changelog v2.14.0 lista **apenas** o validado no código. Itens em roadmap marcados como tal ("em repo interno", não "entregue").

### 7. Bump versão

- SDK: **2.13.0 → 2.14.0**
- OpenAPI: **3.7.2 → 3.8.0**
- `APP_VERSION`: **2.28.0 → 2.29.0**

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/erp/SdkDownloadButtons.tsx` | Timeout real (TS+PY+JS); `@deprecated` JSDoc em 8 métodos TS+JS; `warnings.warn` em 8 métodos PY; bump 2.14.0 |
| `src/components/erp/ApiDocumentation.tsx` | `deprecated:true` + `x-sunset` em 8 paths; resposta JSON real em `/erp-export-payment/`; bump 3.8.0; changelog disciplinado |
| `src/components/erp/__tests__/sdk-smoke.test.ts` | Novo — 5 invariantes |
| `src/lib/version.ts` | APP_VERSION 2.29.0 |

## Não-escopo

Suíte Vitest completa (repo interno); geração automática via openapi-generator; consolidação família legacy vs moderna.

## Impacto esperado

8.5 → 9.0+ com changelog em sincronia 1:1 com o código. Preparação para GA.

