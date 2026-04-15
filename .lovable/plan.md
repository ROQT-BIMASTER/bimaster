

# Revisao Completa Portal de Integracao — Correcao de Tipos + Dados de Teste

## Problema Principal (BLOQUEANTE)

Os SDKs e OpenAPI definem `codigo_cliente_fornecedor`, `id_conta_corrente`, `empresa_id` e `codigo_projeto` como `number`/`integer`, mas as Edge Functions (Zod schemas) aceitam `string` (CP) ou `z.union([z.string(), z.number()])` (CR). O banco usa `bigint`/`integer`, porem a API faz coercao. O SDK deve aceitar `string | number` para maxima compatibilidade, com preferencia por string na documentacao.

## Arquivos Alterados

| Arquivo | Alteracoes |
|---|---|
| `src/components/erp/SdkDownloadButtons.tsx` | Corrigir tipos nos 3 SDKs |
| `src/components/erp/ApiDocumentation.tsx` | Corrigir tipos nos schemas OpenAPI + exemplos no portal |
| `supabase/functions/api-sandbox/index.ts` | Ajustar mocks para usar strings nos campos afetados |

## Bloco 1 — TypeScript SDK (dentro de `generateTsSDK`)

Campos a alterar de `number` para `string | number`:

- `CpIncluirPayload.codigo_cliente_fornecedor`: `number` → `string | number`
- `CpIncluirPayload.id_conta_corrente?`: `number` → `string | number`
- `CpIncluirPayload.empresa_id?`: `number` → `string | number`
- `CpIncluirPayload.codigo_projeto?`: `number` → `string | number`
- `CpUpsertPayload.empresa_id`: `number` → `string | number` (obrigatorio)
- `CpLancarPagamentoPayload.id_conta_corrente?`: `number` → `string | number`
- `CrIncluirPayload.codigo_cliente_fornecedor`: `number` → `string | number`
- `CrIncluirPayload.id_conta_corrente?`: `number` → `string | number`
- `CrIncluirPayload.empresa_id?`: `number` → `string | number`
- `CrUpsertPayload.empresa_id`: `number` → `string | number`
- `CrRecebimentoPayload.id_conta_corrente?`: `number` → `string | number`
- `EmpresaAlterarPayload.codigo_empresa`: `number` → `string | number`
- `FornecedorPayload.empresa_ids?`: `number[]` → `(string | number)[]`

Atualizar exemplos no final do SDK para usar strings.

## Bloco 2 — Python SDK (dentro de `generatePySDK`)

Usar `Union[str, int]` para os mesmos campos:

- `CpIncluirPayload.codigo_cliente_fornecedor`: `int` → `Union[str, int]`
- `CpIncluirPayload.id_conta_corrente`: `Optional[int]` → `Optional[Union[str, int]]`
- `CpIncluirPayload.empresa_id`: `Optional[int]` → `Optional[Union[str, int]]`
- `CpUpsertPayload.empresa_id`: `int = 0` → `Union[str, int] = ""`
- `CpPagamentoPayload.id_conta_corrente`: `Optional[int]` → `Optional[Union[str, int]]`
- `CrIncluirPayload.codigo_cliente_fornecedor`: `int` → `Union[str, int]`
- `CrIncluirPayload.id_conta_corrente`: `Optional[int]` → `Optional[Union[str, int]]`
- `CrIncluirPayload.empresa_id`: `Optional[int]` → `Optional[Union[str, int]]`
- `CrUpsertPayload.empresa_id`: `int = 0` → `Union[str, int] = ""`
- `CrRecebimentoPayload.id_conta_corrente`: `Optional[int]` → `Optional[Union[str, int]]`
- `EmpresaAlterarPayload.codigo_empresa`: `int` → `Union[str, int]`
- `FornecedorPayload.empresa_ids`: `Optional[List[int]]` → `Optional[List[Union[str, int]]]`

Adicionar `Union` ao import: `from typing import Optional, Dict, Any, List, Union`

Atualizar exemplo no `__main__` para usar strings.

## Bloco 3 — JavaScript SDK (dentro de `generateJsSDK`)

Alterar JSDoc `@param {number}` para `@param {string|number}` nos campos:

- `cpIncluir` → `titulo.codigo_cliente_fornecedor`, `titulo.empresa_id`
- `cpLancarPagamento` → `pagamento.id_conta_corrente`
- `crIncluir` → `titulo.codigo_cliente_fornecedor`
- `fornecedoresIncluir` → `body.empresa_ids` de `{number[]}` para `{Array<string|number>}`
- `empresasConsultar` → `codigoEmpresa` de `{number}` para `{string|number}`

## Bloco 4 — OpenAPI Schemas (ApiDocumentation.tsx)

Nos schemas `components.schemas`, alterar `"type": "integer"` para tipo union nos campos:

- `ContaPagarInput`: `codigo_cliente_fornecedor`, `id_conta_corrente`, `empresa_id`, `codigo_projeto`
- `PagamentoInput`: `id_conta_corrente`
- `ContaReceberInput`: `codigo_cliente_fornecedor`, `id_conta_corrente`, `empresa_id`
- `RecebimentoInput`: `id_conta_corrente`

Formato OpenAPI 3.0 para union: `oneOf: [{ type: "string" }, { type: "integer" }]`

Atualizar exemplos no portal (body dos endpoints CP/CR) para usar strings.

## Bloco 5 — Sandbox Mocks

Atualizar mocks em `api-sandbox/index.ts` para usar strings nos campos `codigo_cliente_fornecedor`, `empresa_id`, `id_conta_corrente`.

## Bloco 6 — Dados de Teste no Banco

Inserir dados simulados para facilitar integracao:

- 1 conta corrente de teste (com dados bancarios completos)
- 1 fornecedor de teste
- 1 cliente de teste
- 2 titulos CP (1 pendente, 1 pago)
- 1 titulo CR pendente
- 1 categoria de teste

Usar a empresa_id existente (8) e marcar todos com `importado_api = 'S'` e prefixo `SANDBOX-` no `codigo_lancamento_integracao`.

## Bloco 7 — Testes Bilaterais (Edge Functions)

Testar via `curl_edge_functions`:
- CP: status, incluir, listar, consultar
- CR: status, incluir, listar
- Clientes: listar
- Empresas: listar
- Categorias: listar
- Webhook: listar

Corrigir qualquer erro encontrado.

## Versao

Manter SDK em 2.4.0 (correcao de tipos nao e feature nova, e bugfix).

