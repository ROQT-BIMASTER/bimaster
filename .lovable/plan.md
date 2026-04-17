

# v2.12.0 / OpenAPI 3.7.1 — Restaurar Paridade Total (9.5+)

## Diagnóstico

Parecer 9.3 → meta 9.5+. Três gaps pequenos e bem delimitados, todos identificados pelo revisor:

1. **Paridade quebrada**: 4 métodos CP novos só no TS (60), faltando em JS e Python (ambos em 56).
2. **OpenAPI**: resposta de `/erp-export-payment/` ainda como string JSON escapada.
3. **Edge Function**: validar ao vivo se referência inexistente retorna 400 (não 500).

## Escopo

### 1. Espelhar 4 métodos CP novos em JS e Python (+0.1)

Em `src/components/erp/SdkDownloadButtons.tsx`:

**Bloco JS** — adicionar:
- `cpAnexosIncluir({ conta_pagar_id, nome_arquivo, tipo?, url?, observacao? }, opts?)`
- `cpAnexosListar({ conta_pagar_id })`
- `cpCancelarLote({ codigos[], motivo }, opts?)`
- `cpParcelasSync(parcelas[], opts?)`

Usar mesmo padrão dos demais (validação local, suporte a `retry`/`idempotencyKey`/`timeout`, JSDoc inline).

**Bloco Python** — adicionar com TypedDicts:
- `cp_anexos_incluir(...) -> CpAnexoResponse`
- `cp_anexos_listar(conta_pagar_id) -> CpAnexosListResponse`
- `cp_cancelar_lote(codigos, motivo, ...) -> CpCancelarLoteResponse`
- `cp_parcelas_sync(parcelas, ...) -> CpParcelasSyncResponse`

URL encoding via `urlencode`/`quote`, dispatch via `_cp_dispatch`, suporte a `retry`/`idempotency_key`/`timeout`.

Cobertura volta para 60/60/60.

### 2. Resposta JSON real em `/erp-export-payment/` no OpenAPI (+0.05)

Em `src/components/erp/ApiDocumentation.tsx`, localizar `responses['200']` do path `/erp-export-payment/` e substituir o `example` string escapada por objeto:

```json
{
  "success": true,
  "exports": [{ "id": "uuid", "status": "exported", "external_id": "REF-001" }],
  "registration": { "created": 1, "updated": 0 },
  "payment": { "settled": 1 }
}
```

Adicionar `schema` mínimo com `success` (boolean), `exports` (array), `registration` (object) e `payment` (object).

### 3. Validar Edge Function `erp-export-payment` ao vivo (+0.1)

Disparar 2 chamadas via `supabase--curl_edge_functions` para confirmar comportamento:

- **`payment_queue_id` UUID válido mas inexistente** → esperado: 400 com `{ error: "not_found", message: "Registro não encontrado" }` (não 500)
- **`payment_queue_id` referenciando registro já exportado** → esperado: 400 com mensagem específica

Se algum retornar 500, ajustar o `try/catch` em `supabase/functions/erp-export-payment/index.ts` para tratar `PGRST116` (not found) e demais erros de negócio como 400 estruturado.

### 4. Bump versão e changelog

- SDK: **v2.11.0 → v2.12.0**
- OpenAPI: **3.7.0 → 3.7.1**
- `APP_VERSION`: **2.26.0 → 2.27.0**
- Changelog v2.12.0: paridade JS/Python restaurada (4 métodos CP), resposta JSON real em `/erp-export-payment/`, tratamento 400 para referência inexistente confirmado.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/erp/SdkDownloadButtons.tsx` | Bloco JS: 4 métodos CP novos. Bloco Python: 4 métodos + TypedDicts. Bump v2.12.0 |
| `src/components/erp/ApiDocumentation.tsx` | Resposta JSON real em `/erp-export-payment/`, bump 3.7.1, changelog v2.12.0 |
| `src/lib/version.ts` | APP_VERSION 2.27.0 |
| `supabase/functions/erp-export-payment/index.ts` | Ajuste só se curl revelar 500 em referência inexistente |

## Não-escopo

Mantém fora: testes Vitest do SDK, deprecation plan formal, geração automática via OpenAPI generator.

## Impacto esperado

9.3 → 9.5+ se os 3 itens entrarem e a Edge Function passar nos 2 curls de validação.

