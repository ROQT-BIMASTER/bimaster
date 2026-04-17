

# v2.15.0 / OpenAPI 3.8.1 — Fechar de verdade os 4 itens da v2.14.0

## Diagnóstico

Parecer 7.5 (caiu de 9.4 → 8.5 → 7.5 em 2 rodadas). Funcionalidade está OK. O problema é **disciplina de release**: a v2.14.0 anunciou 4 itens corretivos e entregou 1 (timeout TS). Esta rodada fecha os 3 que ficaram, sem anunciar nada novo.

Gaps confirmados pelo revisor com grep:
1. **Python timeout hardcoded** — `requests.request(..., timeout=30)` na linha ~545. `_request`/`_cp_dispatch`/`_cr_dispatch` não aceitam `timeout`.
2. **Zero `@deprecated` JSDoc** nos 8 métodos legados TS/JS.
3. **Zero `warnings.warn(DeprecationWarning)`** nos 8 métodos legados Python.
4. **Zero `"deprecated": true` / `"x-sunset"`** na OpenAPI.
5. **Smoke test** existe (`__tests__/sdk-smoke.test.ts` foi criado em v2.14.0) mas precisa virar referência honesta no changelog.

## Escopo

### 1. Python: timeout real ponta a ponta

Em `src/components/erp/SdkDownloadButtons.tsx` (bloco Python):

- `_request(self, method, path, body=None, idempotency_key=None, timeout: Optional[int] = None)` — aceita timeout.
- `requests.request(..., timeout=timeout if timeout is not None else 30)`.
- `_request_with_retry(..., timeout=None)` propaga.
- `_cp_dispatch(..., timeout=None)` e `_cr_dispatch(..., timeout=None)` propagam.
- Métodos de lote (`cp_upsert_lote`, `cp_parcelas_sync`, `cr_upsert_lote`, etc.) expõem `timeout: Optional[int] = None` como kwarg e passam adiante.

### 2. TS/JS: `@deprecated` JSDoc nos 8 métodos legados

Em TS e JS (mesmo arquivo), adicionar acima de cada método:

```typescript
/**
 * @deprecated since 2.15.0, will be removed in 4.0.0 (2026-09-30). Use {alternativa}.
 * Alterar título. v2.7.0: aceita opts { retry, idempotencyKey, timeout }.
 */
```

Métodos:
- `cpAlterar` → use `cpUpsert`
- `cpListar` → use `cpQuery`
- `cpRegistrarPagamento` → use `cpLancarPagamento`
- `cpCancelarPagamento` → use `cpEstornar`
- `crAlterar` → use `crUpsert`
- `crListar` → use `crQuery`
- `crRegistrarRecebimento` → use `crLancarRecebimento`
- `crCancelarRecebimento` → use `crEstornar`

### 3. Python: `warnings.warn(DeprecationWarning)` nos 8 métodos legados

Garantir `import warnings` no topo. No início de cada método deprecated:

```python
def cp_alterar(self, ...):
    warnings.warn(
        "cp_alterar deprecated desde 2.15.0, removido em 4.0.0 (2026-09-30). Use cp_upsert.",
        DeprecationWarning, stacklevel=2,
    )
    ...
```

Métodos: `cp_alterar`, `cp_listar`, `cp_registrar_pagamento`, `cp_cancelar_pagamento`, `cr_alterar`, `cr_listar`, `cr_registrar_recebimento`, `cr_cancelar_recebimento`.

### 4. OpenAPI: `deprecated: true` + `x-sunset` + `x-deprecation-replacement`

Em `src/components/erp/ApiDocumentation.tsx`. Os campos `deprecated`/`xSunset`/`xReplacement` já foram adicionados ao tipo `Endpoint` na v2.14.0 — agora preencher nos 8 endpoints legados:

| Path legado | Replacement |
|---|---|
| POST `/contas-pagar-api/alterar` | `/contas-pagar-api/upsert` |
| POST `/contas-pagar-api/listar` | `/contas-pagar-api/query` |
| POST `/contas-pagar-api/registrar-pagamento` | `/contas-pagar-api/lancar-pagamento` |
| POST `/contas-pagar-api/cancelar-pagamento` | `/contas-pagar-api/estornar` |
| (4 equivalentes em `/contas-receber-api/`) | idem |

Sunset: `2026-09-30`. Confirmar que o gerador da spec OpenAPI propaga esses 3 campos (deve estar pronto da v2.14.0).

### 5. Changelog v2.15.0 — disciplina

Listar **só o validado por grep**:
- "Python: timeout configurável propagado em `_request` → `requests.request` (verificável: `grep timeout=timeout`)"
- "TS/JS: `@deprecated` JSDoc em 8 métodos legados (verificável: `grep -c '@deprecated'` = 8)"
- "Python: `warnings.warn(DeprecationWarning)` em 8 métodos legados (verificável: `grep -c warnings.warn` = 8)"
- "OpenAPI: 8 paths legados marcados com `deprecated:true` + `x-sunset:2026-09-30` (verificável: `grep -c '\"deprecated\": true'` ≥ 8)"
- Smoke test referenciado como **`src/components/erp/__tests__/sdk-smoke.test.ts` (interno ao repo do portal, não distribuído com o SDK gerado)** — sem chamar de "público no pacote".

### 6. Bump versão

- SDK: **2.14.0 → 2.15.0**
- OpenAPI: **3.8.0 → 3.8.1**
- `APP_VERSION`: **2.29.0 → 2.30.0**

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/erp/SdkDownloadButtons.tsx` | Python: timeout em `_request`/`_request_with_retry`/`_cp_dispatch`/`_cr_dispatch`/métodos de lote. TS+JS+PY: deprecation real em 8 métodos. Bump 2.15.0 |
| `src/components/erp/ApiDocumentation.tsx` | `deprecated:true` + `xSunset` + `xReplacement` nos 8 endpoints legados. Bump 3.8.1. Changelog v2.15.0 disciplinado |
| `src/lib/version.ts` | APP_VERSION 2.30.0 |

## Validação pós-edição (auto-grep antes de fechar)

Rodar literalmente:
```bash
grep -c "@deprecated" src/components/erp/SdkDownloadButtons.tsx   # esperado: ≥ 16 (8 TS + 8 JS)
grep -c "warnings.warn" src/components/erp/SdkDownloadButtons.tsx # esperado: ≥ 8
grep -c "deprecated: true" src/components/erp/ApiDocumentation.tsx # esperado: ≥ 8
grep "timeout=timeout" src/components/erp/SdkDownloadButtons.tsx  # esperado: presente em Python
```

Se algum grep falhar, ajustar antes de declarar a rodada concluída.

## Não-escopo

Suíte Vitest completa, openapi-generator automático, consolidação família legacy vs moderna.

## Impacto esperado

7.5 → 8.5+ pela restauração da fidelidade changelog↔código. Desbloqueia trajetória rumo a GA.

