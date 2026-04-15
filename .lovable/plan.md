

# Correcao de Tipos — Coercao string|number nos Schemas Zod (CP e CR)

## Problema

Campos de referencia (IDs ERP) definidos como `z.string()` rejeitam `number` com erro 400. O SDK documenta `string | number` mas a API so aceita `string`.

## Campos Afetados

Campos de referencia que integradores podem enviar como numero:

| Campo | Natureza |
|---|---|
| `codigo_cliente_fornecedor` | Codigo ERP numerico |
| `id_conta_corrente` | Codigo ERP numerico |
| `codigo_conta_corrente` | Alias no LancarPagamento |
| `codigo_projeto` | Codigo ERP numerico |
| `codigo_categoria` | Pode ser numerico |
| `codigo_lancamento_integracao` | Pode ser numerico |
| `numero_documento` | Pode ser numerico |
| `parcela` | Ja aceita union (OK) |
| `empresa_id` | Ja usa preprocess Number (OK) |

## Padrao de Correcao

Substituir `z.string()` por `z.union([z.string(), z.number()]).transform(String)` em todos os campos de referencia. Manter `.optional()`, `.min()`, `.max()` onde aplicavel.

## Arquivo 1: `contas-pagar-api/index.ts`

**IncluirSchema** (linhas 14-35):
- `codigo_lancamento_integracao`: adicionar union (linha 14)
- `codigo_cliente_fornecedor`: ja tem preprocess, trocar para union+transform (linha 15)
- `codigo_categoria`: adicionar union (linha 18)
- `id_conta_corrente`: ja tem preprocess, trocar para union+transform (linha 20)
- `numero_documento`: adicionar union (linha 24)
- `codigo_projeto`: ja tem preprocess, trocar para union+transform (linha 34)

**AlterarSchema** (linhas 37-56):
- `codigo_lancamento_integracao`: adicionar union (linha 38)
- `codigo_categoria`: adicionar union (linha 47)
- `id_conta_corrente`: adicionar union (linha 49)
- `codigo_cliente_fornecedor`: adicionar union (linha 55)
- `numero_documento`: se existir

**UpsertSchema** (linhas 58-81):
- Mesmos campos: `codigo_lancamento_integracao`, `codigo_categoria`, `id_conta_corrente`, `codigo_cliente_fornecedor`, `numero_documento`

**LancarPagamentoSchema** (linhas 83-95):
- `codigo_lancamento_integracao`: adicionar union (linha 85)
- `codigo_conta_corrente`: adicionar union (linha 87)
- `codigo_baixa_integracao`: adicionar union (linha 86)

**CancelarPagamentoSchema** (linhas 97-100):
- `codigo_baixa`: adicionar union
- `codigo_baixa_integracao`: adicionar union

## Arquivo 2: `contas-receber-api/index.ts`

**IncluirSchema** (linhas 18-29):
- `codigo_lancamento_integracao`: adicionar union (linha 19)
- `codigo_cliente_fornecedor`: trocar preprocess para union (linha 20)
- `codigo_categoria`: adicionar union (linha 24)

**AlterarSchema** (linhas 31-40):
- `codigo_lancamento_integracao`: adicionar union (linha 33)
- `codigo_categoria`: adicionar union (linha 37)
- `codigo_cliente_fornecedor`: trocar preprocess para union (linha 39)

**RecebimentoSchema** (linhas 44-52):
- `codigo_lancamento_integracao`: adicionar union (linha 45)

**CancelarSchema** (linhas 54-57):
- `chave_lancamento`: adicionar union
- `codigo_lancamento_integracao`: adicionar union

**LoteItemSchema** (linhas 59-67):
- `codigo_lancamento_integracao`: adicionar union (linha 60)
- `codigo_cliente_fornecedor`: trocar preprocess para union (linha 61)
- `codigo_categoria`: adicionar union (linha 65)

## Resultado

Todos os campos de referencia aceitarao `string` ou `number`, com coercao automatica para `string` via `.transform(String)`. Campos puramente textuais (`descricao`, `observacao`, `fornecedor_nome`) permanecem `z.string()`.

