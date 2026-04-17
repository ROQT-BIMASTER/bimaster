

## Análise

Parecer 9.0/10. GA-ready. Revisor confirma os 4 itens da v2.14.0 fechados via grep verificável e elogia a disciplina de release ("changelog anuncia fix → fornece o grep que prova → grep bate"). 

Lista 4 ganhos marginais (não-blockers) para subir de 9.0 → 9.5+:

1. **`last_request_id` exposto no SDK** — guardar `X-Request-ID` da resposta para logging do cliente. Retornar em `HuggsAPIError.data` e expor como propriedade pública (`client.last_request_id`).
2. **`/erp-export-payment` response** — resposta ainda como string escapada na OpenAPI (afeta openapi-generator).
3. **Disambiguação `cancelar` vs `estornar`** em CP — documentar coexistência por design no OpenAPI description, sem deprecar nenhum.
4. **Smoke test mínimo distribuível** — extrair 5-10 cases do `__tests__/sdk-smoke.test.ts` e incluir como `tests/smoke_minimal.{py,ts,js}` no SDK gerado.

## Escopo v2.16.0 / OpenAPI 3.8.2

### 1. Observabilidade: `last_request_id` (+0.2)

**TypeScript** (`SdkDownloadButtons.tsx`):
- Adicionar `public lastRequestId: string | null = null;` na classe.
- Em `_request`, após receber resposta: `this.lastRequestId = response.headers.get('x-request-id');`
- `HuggsAPIError` ganha campo `requestId?: string` populado a partir do header da resposta de erro.

**Python**:
- `self.last_request_id: Optional[str] = None` em `__init__`.
- Em `_request`, após `resp`: `self.last_request_id = resp.headers.get('x-request-id')`.
- `HuggsAPIError` aceita `request_id` como kwarg e expõe como atributo.

**JavaScript**: paralelo ao TS.

### 2. Disambiguação `cancelar` vs `estornar` no OpenAPI (+0.05)

Em `ApiDocumentation.tsx`, nas descriptions dos paths CP `/cancelar-pagamento` e `/estornar`, adicionar nota explicando coexistência por design:
- `cancelar-pagamento`: anula registro de pagamento sem motivo formal (operacional).
- `estornar`: estorno auditável com motivo obrigatório (contábil).

### 3. `/erp-export-payment` response como objeto JSON (+0.05)

Buscar ocorrência restante e substituir example string escapada por objeto estruturado.

### 4. Smoke test mínimo no SDK distribuível (+0.2)

Adicionar bloco no final de cada SDK (Python/TS/JS) gerado via `SdkDownloadButtons.tsx`:

**Python** — `# === SMOKE TESTS (run: python -m huggs_erp_sdk.smoke) ===` com 5 cases sem rede:
- Idempotência: mesma key → mesmo header em 2 chamadas mockadas.
- `codigo_status="1"` → levanta `HuggsAPIError`.
- URL encoding: espaço/acento.
- `cp_upsert_lote([])` → `ValueError`.
- Timeout propaga: mock `requests.request`, verifica `timeout=120` em kwargs.

**TS/JS**: equivalente como bloco comentado executável via `npx tsx` ou nota com link de exemplo.

### 5. Disciplina de changelog (mantida)

Changelog v2.16.0 lista cada item com grep verificável:
- `grep -c "lastRequestId\|last_request_id" SdkDownloadButtons.tsx` ≥ 6 (3 declarações + 3 atribuições)
- `grep "x-request-id" SdkDownloadButtons.tsx` ≥ 3
- `grep -c "smoke" SdkDownloadButtons.tsx` ≥ 3 (1 por linguagem)
- `grep "cancelar.*estornar\|estornar.*cancelar" ApiDocumentation.tsx` presente

### 6. Bump versão

- SDK: **2.15.0 → 2.16.0**
- OpenAPI: **3.8.1 → 3.8.2**
- `APP_VERSION`: **2.30.0 → 2.31.0**

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/erp/SdkDownloadButtons.tsx` | `lastRequestId` em TS+JS+PY; `HuggsAPIError.requestId/request_id`; smoke test mínimo embutido nos 3 SDKs; bump 2.16.0 |
| `src/components/erp/ApiDocumentation.tsx` | Disambiguação `cancelar`/`estornar` nas descriptions; `/erp-export-payment` response como objeto; bump 3.8.2; changelog v2.16.0 disciplinado |
| `src/lib/version.ts` | APP_VERSION 2.31.0 |

## Validação pós-edição (auto-grep)

```bash
grep -c "lastRequestId\|last_request_id" src/components/erp/SdkDownloadButtons.tsx  # >= 6
grep -c "x-request-id" src/components/erp/SdkDownloadButtons.tsx                    # >= 3
grep -c "smoke" src/components/erp/SdkDownloadButtons.tsx                           # >= 3
grep "estornar" src/components/erp/ApiDocumentation.tsx                             # presente nas descriptions
```

## Não-escopo

Suíte Vitest completa pública; openapi-generator automático; consolidação família legacy/moderna; deprecation de `cancelar` (mantida por design).

## Impacto esperado

9.0 → 9.5+. Fecha os 4 ganhos marginais listados pelo revisor. Mantém disciplina de grep-verificável que restaurou credibilidade na v2.15.0.

