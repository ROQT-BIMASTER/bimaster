

# Correcao 5 — Placeholders Descritivos na Documentacao e Exemplos

## Problema

Valores hardcoded (`4214850`, `4243124`, `427619317`, `2485994`) aparecem em 4 arquivos: documentacao, API tester URLs, sandbox mock e contexto do assistente AI. Causam confusao e erros ao copiar/colar.

## Arquivos e Alteracoes

### 1. `src/components/erp/ApiDocumentation.tsx`

| Linha | Endpoint | Correcao |
|---|---|---|
| 154 | CP `/incluir` body | `codigo_cliente_fornecedor`: `"uuid-do-fornecedor"`, remover `data_previsao` e `id_conta_corrente` |
| 174 | CP `/upsert` body | `empresa_id`: `"uuid-da-empresa"`, `codigo_cliente_fornecedor`: `"uuid-do-fornecedor"` |
| 261 | Lanc CC `/incluir` body | `nCodCC`: `"codigo-da-conta-corrente"`, `nCodCliente`: `"codigo-do-cliente"` |
| 264 | Lanc CC `/upsert` body | `nCodCC`: `"codigo-da-conta-corrente"` |
| 265 | Lanc CC `/upsert-lote` body | `nCodCC`: `"codigo-da-conta-corrente"` |
| 266 | Extrato response | `nCodCC`: `"codigo-da-conta-corrente"` (exemplo de response, manter numerico OK) |
| 272 | CR `/incluir` body | `codigo_cliente_fornecedor`: `"uuid-do-cliente"` |
| 275 | CR `/upsert` body | `empresa_id`: `"uuid-da-empresa"`, `codigo_cliente_fornecedor`: `"uuid-do-cliente"` |
| 477 | Fornecedores response | `erp_code`: `"4214850"` — ja e string, OK como exemplo ERP |
| 481 | Fornecedores sync response | `erp_code`: `"4214850"` — idem, OK |

### 2. `src/components/erp/ApiTester.tsx` (URLs)

| Linha | Correcao |
|---|---|
| 117 | `nCodCC=427619317` → `nCodCC=COLE_O_CODIGO` |
| 118 | `nCodCC=427619317` → `nCodCC=COLE_O_CODIGO` |

### 3. `supabase/functions/api-support-ai/index.ts` (contexto AI)

| Linha | Correcao |
|---|---|
| 73 | `"codigo_cliente_fornecedor": 4214850` → `"codigo_cliente_fornecedor": "uuid-do-fornecedor"` |
| 77-78 | Remover `data_previsao` e `id_conta_corrente` do exemplo |

### 4. `supabase/functions/api-sandbox/index.ts`

Os valores `427619317` e `4214850` aqui sao dados mock do sandbox — servem como resposta simulada, nao como input do usuario. Manter inalterados (sandbox retorna dados ficticios por design).

## Resumo

- 8 bodies corrigidos em `ApiDocumentation.tsx`
- 2 URLs corrigidas em `ApiTester.tsx`
- 1 exemplo corrigido em `api-support-ai/index.ts`
- Sandbox mantido (dados mock internos)

