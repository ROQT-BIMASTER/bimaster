

# Análise da sugestão de tipos AP — adoção parcial

A sugestão é boa em **intenção**, mas tem três conflitos com o que já está consolidado em `src/types/financeiro/contas-pagar.ts` (criado na refatoração anterior) e no SDK público publicado em `SdkDownloadButtons.tsx`. Adoção integral causaria regressão. Adoção parcial agrega valor real.

## O que aproveitar (3 melhorias)

### 1. Criar `enum FormaPagamento` (faltava)
Hoje `forma_pagamento` está como **union literal** repetida em dois lugares (`Pagamento` e `LancarPagamentoInput`). Promover a enum nomeado elimina duplicação e dá autocomplete.

```ts
export enum FormaPagamento {
  DINHEIRO = "dinheiro",
  CHEQUE = "cheque",
  PIX = "pix",
  BOLETO = "boleto",
  CARTAO = "cartao",
  TRANSFERENCIA = "transferencia",
  API = "API",
}
```
Mantém os 7 valores já validados pelo Zod backend (`_shared/contas-pagar/types.ts:89`) — **não** os 5 da sugestão (que omitia `cheque` e `API`, quebraria backend).

### 2. Tipar `status` e `tipo_documento` na entidade `ContaPagar`
Hoje ambos são `string` solto. Trocar para os enums já existentes (`StatusTitulo`, `TipoDocumento`) dá segurança de tipo nas telas:
```ts
status: StatusTitulo;
tipo_documento: TipoDocumento | null;
```

### 3. Adicionar campos PR-23 que faltam na entidade
A sugestão lembra de campos fiscais que o backend já persiste mas a interface `ContaPagar` ainda não declara: `chave_nfe`, `numero_documento_fiscal`, `numero_pedido`, `codigo_projeto`, `codigo_tipo_documento`. Adicionar como opcionais.

## O que rejeitar (3 conflitos)

| Sugestão | Por quê rejeitar |
|---|---|
| `StatusTitulo.PENDENTE = "pendente"` (lowercase) + novos valores `PARCIAL`/`VENCIDO` | SDK público (`SdkDownloadButtons.tsx:268`, JS freeze linha 1917, Python linha 3004) usa **UPPERCASE** com 4 valores. Mudar quebra integradores externos. `parcial`/`vencido` são *status calculados* via `useFinancialStatus.ts`, não persistidos. |
| `TipoDocumento` reduzido a 4 (`NF/Boleto/Duplicata/Recibo`) com casing misto | Atual tem 8 valores em UPPERCASE alinhados ao ERP. Reduzir e remixar casing rejeitaria documentos válidos hoje (`NFE`, `NFSE`, `CONTRATO`, `OUTROS`). |
| `ContaPagarUpsertPayload` minimalista | `UpsertContaPagarInput` atual já cobre **todos** os campos do Zod `UpsertSchema` no backend. Reduzir perderia capacidade de upsert dos campos fiscais PR-23. |

## Implementação

Edição cirúrgica em **um único arquivo**: `src/types/financeiro/contas-pagar.ts`.

1. Adicionar `enum FormaPagamento` com 7 valores.
2. Substituir o union literal duplicado em `Pagamento.forma_pagamento` e `LancarPagamentoInput.forma_pagamento` por `FormaPagamento`.
3. Tipar `ContaPagar.status` como `StatusTitulo` e `ContaPagar.tipo_documento` como `TipoDocumento | null`.
4. Adicionar à `ContaPagar` os 5 campos fiscais opcionais: `chave_nfe?`, `numero_documento_fiscal?`, `numero_pedido?`, `codigo_projeto?`, `codigo_tipo_documento?`.
5. Verificar se `ContaPagar.parcela` deve ser `number | null` (hoje é `number` puro mas o backend retorna nullable) — ajustar se `lsp` confirmar.

Sem alteração em backend, Zod, SDK público, Edge Functions ou `APP_VERSION`. Sem mudança em consumers — o aperto de tipo é compatível pois `StatusTitulo`/`TipoDocumento` são `enum string` cujos valores já batem com o que o backend retorna.

## Validação pós-edição

- `tsc` no diretório (verificar se algum consumer passava string fora dos enums).
- Grep por `forma_pagamento:` em telas para garantir que nenhum literal "PIX"/"DINHEIRO" maiúsculo escape ao novo enum (ex.: `ContaPagarDetalhe.tsx:54` usa `"PIX"` — precisará virar `FormaPagamento.PIX`).

## Não-escopo

- SDK público (`SdkDownloadButtons.tsx`) não muda.
- Backend Zod não muda.
- Sem bump de `APP_VERSION` nem entrada de changelog (mudança puramente interna de tipos do front).
- Não criar `src/types/contas-pagar.ts` raiz (sugestão original) — já temos canônico em `src/types/financeiro/contas-pagar.ts`.

