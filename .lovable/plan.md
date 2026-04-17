

# v2.10.0 / OpenAPI 3.6.0 — Fechar para 9.5+

## Diagnóstico

3 itens pendentes pequenos. Os dois primeiros são cosméticos/locais. O terceiro (Edge Function 500) já foi refatorado em v2.9.0 com `secureHandler` + Zod + 400 estruturado, mas precisa **validação ao vivo** com curl para confirmar que payload inválido retorna 400 e não 500.

## Escopo

### 1. Validar Edge Function `erp-export-payment` ao vivo (item crítico)

Disparar 3 chamadas via `supabase--curl_edge_functions` para confirmar que o refactor v2.9.0 está em produção:

- **Payload vazio** `{}` → esperado: 400 com `{ error: "validation_error", details: [...] }`
- **`payment_queue_id` não-UUID** `{ "payment_queue_id": "abc", "export_type": "payment" }` → esperado: 400
- **`export_type` inválido** `{ "payment_queue_id": "<uuid válido>", "export_type": "foo" }` → esperado: 400

Se algum retornar 500 "Unknown error", investigar `supabase/functions/erp-export-payment/index.ts` e ajustar o `try/catch` para garantir que `ValidationError` não seja engolida.

### 2. Adicionar `_validate` em `cpQuery` (TS/JS/Python)

Espelhar o que já existe em `crExcluir` v2.9.0:
- Validar que pelo menos um filtro foi passado (rejeitar objeto vazio)
- Rejeitar chaves desconhecidas com lista branca: `codigo_lancamento_integracao`, `codigo_lancamento_huggs`, `data_inicial`, `data_final`, `codigo_status`, `id_fornecedor`, `numero_documento`, `limite`, `pagina`

Localização: bloco TS, JS e Python em `src/components/erp/SdkDownloadButtons.tsx`.

### 3. Trocar exemplo string por JSON real em `POST /erp-export-payment/` no OpenAPI

Em `src/components/erp/ApiDocumentation.tsx`, localizar o bloco do path `/erp-export-payment/` e substituir o `example` string por:

```json
{
  "payment_queue_id": "550e8400-e29b-41d4-a716-446655440000",
  "export_type": "payment",
  "channel": "manual"
}
```

Adicionar também `requestBody.content.application/json.schema` mínimo (`payment_queue_id: string format uuid`, `export_type: enum [registration, payment]`, `channel: string`).

### 4. Bump versão e changelog

- SDK: **v2.9.0 → v2.10.0**
- OpenAPI: **3.5.0 → 3.6.0**
- `APP_VERSION`: **2.24.0 → 2.25.0** (forçar refresh do portal)
- Changelog em `ApiDocumentation.tsx`: validação `cpQuery`, exemplo JSON real em `/erp-export-payment/`, validação ao vivo da Edge Function confirmada.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/erp-export-payment/index.ts` | Ajuste só se curl revelar 500 ao invés de 400 |
| `src/components/erp/SdkDownloadButtons.tsx` | `_validate` em `cpQuery` (TS/JS/PY); bump v2.10.0 |
| `src/components/erp/ApiDocumentation.tsx` | Exemplo JSON + schema em `/erp-export-payment/`, bump OpenAPI 3.6.0, changelog v2.10.0 |
| `src/lib/version.ts` | APP_VERSION 2.25.0 |

## Não-escopo

Mantém fora: testes unitários SDK, deprecation formal família CP, pydantic no payload Python.

## Impacto esperado

9.2 → 9.5+ se os 3 curls confirmarem 400 estruturado. Caso contrário, ajuste pontual no `try/catch` da função antes do bump.

