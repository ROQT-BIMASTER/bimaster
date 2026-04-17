

## Diagnóstico

Parecer 9.25/10. Revisor aponta 2 itens cirúrgicos para chegar a 9.5+:

1. **TS/JS smoke comentado**: o bloco `runSmoke()` está dentro de `//` — promessa "auto-contido" não bate. Descomentar 20 linhas em cada SDK (TS + JS).
2. **Python smoke gated em `if False:`**: trocar por `if __name__ == "__main__" and "--smoke" in sys.argv:` para que `python huggs_erp_sdk.py --smoke` (literal do próprio comentário) funcione.

E 1 nota OpenAPI:
3. **`/erp-export-payment` response 200 ainda string escapada**: trocar por objeto JSON real.

## Escopo v2.17.0 / OpenAPI 3.8.4

### 1. TS smoke ativo (`generateTsSDK` em `SdkDownloadButtons.tsx`)

Remover `//` do bloco `runSmoke()`. Resultado executável:

```ts
async function runSmoke() {
  const erp = new HuggsERP("test-key", "https://example.com/test");
  const k1 = (erp as any)._idemKey({ a: 1, b: 2 });
  const k2 = (erp as any)._idemKey({ b: 2, a: 1 });
  console.assert(k1 === k2, "smoke#1 idempotency stable");
  console.assert(erp.lastRequestId === null, "smoke#2 lastRequestId init null");
  // ... + 3 cases (validação array vazio, encoding, error subclass)
}
if (typeof process !== "undefined" && process.argv?.includes("--smoke")) runSmoke();
```

Garantir ≥ 5 `console.assert` para grep verificável.

### 2. JS smoke ativo (`generateJsSDK`)

Mesma operação simétrica ao TS.

### 3. Python smoke gate funcional (`generatePythonSDK`)

Trocar:
```python
if False:  # descomente para rodar
    unittest.main(...)
```
Por:
```python
if __name__ == "__main__" and "--smoke" in sys.argv:
    unittest.main(argv=["", "_SmokeTests"], exit=False, verbosity=2)
```

Adicionar `import sys` se necessário (já presente no SDK).

### 4. `/erp-export-payment` response como objeto JSON

Em `ApiDocumentation.tsx`, localizar o example 200 do endpoint e trocar string escapada por objeto estruturado:

```ts
{ status: 200, example: { success: true, payment_queue_id: "...", request_id: "..." } }
```

### 5. Bump versão

- SDK: **2.16.1 → 2.17.0**
- OpenAPI: **3.8.3 → 3.8.4**
- `APP_VERSION`: **2.31.1 → 2.32.0**

### 6. Changelog v2.17.0 com grep verificável

```
grep -c "console.assert" huggs-erp-sdk.ts  → ≥ 5
grep -c "console.assert" huggs-erp-sdk.js  → ≥ 5
grep "if __name__ == \"__main__\" and \"--smoke\"" huggs_erp_sdk.py  → presente
grep -c "if False:" huggs_erp_sdk.py  → 0 (removido)
```

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/erp/SdkDownloadButtons.tsx` | TS+JS smoke descomentado e executável; Python gate `if False:` → `__main__ + --smoke`; bump 2.17.0 |
| `src/components/erp/ApiDocumentation.tsx` | `/erp-export-payment` response 200 como objeto; bump 3.8.4; changelog v2.17.0 |
| `src/lib/version.ts` | APP_VERSION 2.32.0 |

## Validação pós-edição

Aplicar os 4 greps acima no projeto. Se algum falhar, corrigir antes de declarar release.

## Não-escopo

Hooks `on_request`/`on_response` para Sentry/Datadog (caminho para 10/10); publicação de SLOs; sandbox público com dados de teste — todos itens estratégicos, não cirúrgicos.

## Impacto esperado

9.25 → 9.5+. Fecha o deslize de fidelidade do TS/JS smoke (única perda de 0.25 na rodada anterior) e remove a única nota OpenAPI restante.

