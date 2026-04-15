

# Correcao 6 — OpenAPI Exemplos com Numeros nos Campos de Referencia

## Analise

Os exemplos no OpenAPI sao gerados automaticamente a partir dos `ep.body` das definicoes de endpoint (linha 1673 do gerador). Apos a Correcao 5, os bodies de CP e CR ja usam placeholders string (`"uuid-do-fornecedor"`, `"uuid-da-empresa"`). Portanto, o OpenAPI gerado ja esta correto para esses endpoints.

O unico valor numerico remanescente em campos de referencia de input e:

| Linha | Endpoint | Campo | Valor atual |
|---|---|---|---|
| 483 | Fornecedores `/sync-bidirecional` | `empresa_id` | `8` (numero) |

Os schemas OpenAPI (linhas 1044-1116) definem `oneOf: [string, integer]` para campos como `codigo_cliente_fornecedor`, `id_conta_corrente`, `empresa_id` — isso e correto para documentar compatibilidade com integradores legados.

## Alteracao

**Arquivo: `src/components/erp/ApiDocumentation.tsx`**

### Linha 483 — Fornecedores sync-bidirecional body

```
// ANTES:
body: `{ "empresa_id": 8, "modo": "full" }`

// DEPOIS:
body: `{ "empresa_id": "uuid-da-empresa", "modo": "full" }`
```

Apenas 1 alteracao necessaria. Os demais endpoints ja foram corrigidos nas correcoes anteriores.

