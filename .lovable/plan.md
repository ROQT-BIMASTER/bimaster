

# v2.11.0 / OpenAPI 3.7.0 — GA Pleno (9.5+)

## Diagnóstico

Parecer 9.0 → meta 9.5+. Gaps remanescentes pequenos e bem delimitados. Foco em fechar paridade de tipagem TS, corrigir resposta OpenAPI, adicionar endpoints CP faltantes ao SDK e publicar deprecation plan.

## Escopo

### 1. Paridade de tipagem TS — `crQuery`, `crGetRecebimentos`, `crGetParcelas` (+0.15)

Em `src/components/erp/SdkDownloadButtons.tsx`, bloco TS:
- Criar `CrQueryResponse`, `CrRecebimentosResponse`, `CrParcelasResponse` espelhando os equivalentes CP
- Trocar `Promise<Record<string, unknown>>` pelos tipos novos nas 3 assinaturas
- Espelhar para JS (JSDoc onde aplicável)

### 2. Resposta `/erp-export-payment` em OpenAPI vira JSON real (+0.05)

Em `src/components/erp/ApiDocumentation.tsx`, localizar o bloco `responses['200']` do path `/erp-export-payment/` e substituir o `example` string escapada por objeto:

```json
{
  "success": true,
  "exports": [{ "id": "uuid", "status": "exported", "external_id": "..." }],
  "registration": { "created": 1, "updated": 0 },
  "payment": { "settled": 1 }
}
```

Adicionar `schema` mínimo (success boolean, exports array, registration object, payment object).

### 3. Endpoints CP faltantes no SDK (Python + TS + JS) (+0.15)

Adicionar 6 métodos novos em todos os 3 SDKs:

- **`cpParcelasSync(parcelas[], { retry?, idempotencyKey? })`** → POST `/contas-pagar-api/parcelas/sync`
- **`cpAnexosListar({ conta_pagar_id })`** → GET `/contas-pagar-api/anexos`
- **`cpAnexosIncluir({ conta_pagar_id, nome_arquivo, tipo?, url?, observacao? })`** → POST `/contas-pagar-api/anexos`
- **`cpCancelarLote({ codigos[], motivo }, { retry?, idempotencyKey? })`** → POST `/contas-pagar-api/cancelar-lote`

TypedDicts Python: `CpParcelasSyncResponse`, `CpAnexoResponse`, `CpAnexosListResponse`, `CpCancelarLoteResponse`.
TS interfaces equivalentes.

Cobertura CP sobe de 15/19 → 19/19.

### 4. Timeout configurável por chamada (+0.05)

- Adicionar `timeout?: number` em `CpRequestOptions` / `CrRequestOptions` (TS/JS) e `timeout` em `_cp_dispatch`/`_cr_dispatch` (Python)
- Default permanece 30s; lote sobe default para 60s
- Documentar inline: "Para lotes >100 use `{ retry: true, timeout: 60000 }`"

### 5. Deprecation plan formal (+0.05)

Em `ApiDocumentation.tsx`, adicionar seção "Deprecation Plan" com tabela:

| Método legado | Substituto | Removido em | Data alvo |
|---|---|---|---|
| `cp_alterar` | `cp_upsert` | v4.0.0 | 2026-Q3 |
| `cp_listar` | `cp_query` | v4.0.0 | 2026-Q3 |
| `cp_registrar_pagamento` | `cp_lancar_pagamento` | v4.0.0 | 2026-Q3 |
| `cp_cancelar_pagamento` | `cp_estornar_pagamento` | v4.0.0 | 2026-Q3 |
| (idem família CR) | | | |

Adicionar header `Deprecation: true` + `Sunset: 2026-09-30` nas respostas dos endpoints legados (nota documental, sem alterar Edge Function nesta rodada).

### 6. Suíte mínima de testes (Vitest, +0.10)

Criar `src/components/erp/__tests__/sdk-invariants.test.ts` cobrindo o gerador de string SDK (extrair trechos críticos):

- `cpQuery` rejeita chave desconhecida com mensagem contendo lista permitida
- `crExcluir` rejeita objeto vazio
- `cpUpsertLote` propaga `idempotencyKey` no header quando `retry: true`
- URL encoding em `crListar` escapa `/` e `&` corretamente
- Todos os métodos CP/CR de mutation aceitam `RequestOptions` com `retry`, `idempotencyKey`, `timeout`

Como o SDK é gerado como string, testes exercitam a função geradora + parsing (regex) para garantir que os blocos esperados estão presentes nas 3 linguagens.

### 7. Bump versão e changelog

- SDK: **v2.10.0 → v2.11.0**
- OpenAPI: **3.6.0 → 3.7.0**
- `APP_VERSION`: **2.25.0 → 2.26.0**
- Changelog v2.11.0 em `ApiDocumentation.tsx`: paridade TS completa, resposta JSON real em `erp-export-payment`, 6 endpoints CP novos, timeout configurável, deprecation plan, suíte de testes inicial.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/erp/SdkDownloadButtons.tsx` | Tipos CR no TS, 6 métodos novos CP (TS/JS/PY), timeout em RequestOptions, bump v2.11.0 |
| `src/components/erp/ApiDocumentation.tsx` | Resposta JSON real, seção Deprecation Plan, bump 3.7.0, changelog v2.11.0 |
| `src/lib/version.ts` | APP_VERSION 2.26.0 |
| `src/components/erp/__tests__/sdk-invariants.test.ts` | Novo arquivo, ~5 testes Vitest |

## Não-escopo

- Edge Functions de deprecation real (só doc + header documental)
- Pydantic no payload Python
- Geração formal de SDK por OpenAPI generator (continua manual)

## Impacto esperado

9.0 → 9.5+ se todos os itens entrarem. Restaria só GA pleno (10) com geração automática do SDK e cobertura de teste >80%, fora de escopo desta iteração.

