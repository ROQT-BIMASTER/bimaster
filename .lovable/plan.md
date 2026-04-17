

# Finalizar v2.8.0: Python SDK + ApiDocumentation

## Contexto

TS/JS já recebeu na rodada anterior: retry público em CR, família moderna CR, URL encoding, retry no `cpUpsertLote`. Falta espelhar tudo no Python e atualizar a documentação OpenAPI/changelog. Sem isso, volta a assimetria CP×CR (item #1 do último parecer).

## Escopo desta rodada

### 1. Python SDK — paridade total com TS/JS v2.8.0

**a) Retry público nos métodos CR financeiros** (`*, retry: bool = False, idempotency_key: Optional[str] = None`):
- `cr_incluir`, `cr_alterar`, `cr_upsert`, `cr_excluir`
- `cr_lancar_recebimento`, `cr_cancelar_recebimento`
- `cr_upsert_lote` (criar se não existir, com retry)

**b) Família moderna CR**:
- `cr_consultar(id=None, codigo_lancamento_integracao=None, codigo_lancamento_huggs=None)`
- `cr_query(**filtros)` — query flexível
- `cr_get_recebimentos(cr_id)` — baixas
- `cr_get_parcelas(cr_id)` — parcelas

**c) URL encoding**: aplicar `urllib.parse.quote`/`urlencode` em:
- `cr_listar` (substituir `qs += f"&{k}={v}"`)
- `cr_consultar`, `cr_query`, `cr_excluir`, `cr_get_recebimentos`, `cr_get_parcelas`
- `clientes_consultar` (caso CPF/CNPJ formatado)

**d) Retry no `cp_upsert_lote`**: adicionar `retry`/`idempotency_key`.

**e) TypedDicts de mutation** (espelhar interfaces TS):
- `CpMutationResponse`, `CpPagamentoResponse`, `CpLoteResponse`
- `CrMutationResponse`, `CrRecebimentoResponse`, `CrLoteResponse`
- Atualizar assinaturas: `cp_incluir(...) -> CpMutationResponse`, `cp_lancar_pagamento(...) -> CpPagamentoResponse`, `cp_upsert_lote(...) -> CpLoteResponse`, e equivalentes CR.

**f) Guia inline**: nota sobre `retry=True` + `idempotency_key` derivada para CR e lote (>100 registros).

### 2. ApiDocumentation — bump 3.3.0 → 3.4.0

- Nota "Strongly recommended: enviar `X-Idempotency-Key`" nas descrições dos endpoints financeiros: `/lancar-pagamento`, `/lancar-recebimento`, `/upsert`, `/upsert-lote` (CP e CR).
- Bump `openapi.info.version` para 3.4.0.
- Entrada de changelog v2.8.0 / OpenAPI 3.4.0 cobrindo: paridade CP/CR completa, retry em lote, TypedDicts de mutation Python, recomendação X-Idempotency-Key.

### 3. Validação

- `npx tsc --noEmit -p tsconfig.app.json` para confirmar zero regressão de tipos.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/erp/SdkDownloadButtons.tsx` | Bloco Python: retry CR, família moderna CR, URL encoding CR, retry `cp_upsert_lote`, TypedDicts mutation, guia inline |
| `src/components/erp/ApiDocumentation.tsx` | Nota X-Idempotency-Key, bump OpenAPI 3.4.0, changelog v2.8.0 |

## Não-escopo

Mantém o que já foi explicitamente excluído nas rodadas anteriores: testes unitários, deprecation formal família CP duplicada, reescrita de `CpUpsertPayload` com pydantic.

