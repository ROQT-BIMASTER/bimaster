

# v2.13.0 / OpenAPI 3.7.2 — Fechar último gap cosmético

## Diagnóstico

Parecer 9.4 → meta 9.5+. Um único item pendente, identificado pelo revisor como cosmético mas que ainda aparece como string JSON escapada no OpenAPI:

- **POST `/erp-export-payment/`** — o exemplo de **resposta** (não o request body) ainda está como string escapada no JSON da OpenAPI exibida em `ApiDocumentation.tsx`.

Na rodada v2.12.0 a intenção era trocar isso, mas o revisor confirma que o gap permanece. Provavelmente está em outro local do path (ex: `responses['200']` aninhado em outro nó, ou em uma segunda ocorrência do mesmo path).

## Investigação

1. Buscar todas as ocorrências de `erp-export-payment` em `src/components/erp/ApiDocumentation.tsx`.
2. Localizar o(s) bloco(s) `responses` que ainda contenham `example` como string (padrão `"{ \"...\" }"`).
3. Substituir por objeto JSON real com `schema` mínimo.

## Escopo

### 1. Corrigir resposta JSON real em `/erp-export-payment/` (definitivo)

Substituir qualquer ocorrência de `example` string escapada por objeto:

```json
{
  "success": true,
  "exports": [
    { "id": "uuid", "status": "exported", "external_id": "REF-001" }
  ],
  "registration": { "created": 1, "updated": 0 },
  "payment": { "settled": 1 }
}
```

Garantir `schema` formal com `success` (boolean), `exports` (array of object), `registration` (object) e `payment` (object).

### 2. Validar Edge Function `erp-export-payment` ao vivo

Disparar 3 chamadas via `supabase--curl_edge_functions` para confirmar comportamento estruturado (não 500):

- Payload vazio `{}` → esperado 400 `validation_error`
- `payment_queue_id` UUID válido mas inexistente → esperado 400/404 `not_found`
- `payment_queue_id` referenciando registro já exportado → esperado 400 mensagem específica

Se algum retornar 500, ajustar `try/catch` em `supabase/functions/erp-export-payment/index.ts` para mapear erros de negócio (PGRST116, etc.) como 400 estruturado com `request_id`.

### 3. Bump versão e changelog

- SDK: **v2.12.0 → v2.13.0**
- OpenAPI: **3.7.1 → 3.7.2**
- `APP_VERSION`: **2.27.0 → 2.28.0** (forçar refresh do portal)
- Changelog v2.13.0: resposta JSON real definitivamente em `/erp-export-payment/`, validação ao vivo da Edge Function reconfirmada.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/erp/ApiDocumentation.tsx` | Resposta JSON real em `/erp-export-payment/` (todas as ocorrências), bump 3.7.2, changelog v2.13.0 |
| `src/components/erp/SdkDownloadButtons.tsx` | Bump SDK_VERSION 2.13.0 |
| `src/lib/version.ts` | APP_VERSION 2.28.0 |
| `supabase/functions/erp-export-payment/index.ts` | Ajuste só se curl revelar 500 |

## Não-escopo

Mantém fora: testes Vitest, deprecation plan formal, geração automática via OpenAPI generator.

## Impacto esperado

9.4 → 9.5+ com o último item cosmético resolvido e Edge Function reconfirmada ao vivo.

