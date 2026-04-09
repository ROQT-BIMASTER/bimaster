

# Corrigir status "pendente" → "vencido" para títulos com data passada

## Problema
Na função `calculateFinancialStatus` (linha 17), quando o banco de dados tem `status = 'pendente'`, o sistema retorna `'pendente'` imediatamente **sem verificar a data de vencimento**. Títulos com vencimento no passado ficam eternamente como "pendente" em vez de mostrar "vencido".

## Causa raiz
A lógica atual trata o status do banco como fonte da verdade absoluta. Para `'pago'`, `'parcial'` e `'recebido'` isso faz sentido, mas para `'pendente'` o correto é continuar para a verificação de data, pois "pendente" no ERP significa apenas "não pago" — se já venceu, deve mostrar "vencido".

## Solução
Alterar `src/hooks/useFinancialStatus.ts`: remover o retorno imediato para `statusLower === 'pendente'`, permitindo que a lógica de data de vencimento (linhas 29-44) determine se é `'pendente'` ou `'vencido'`.

```
Antes:  if (statusLower === 'pendente') return 'pendente';  ← remove esta linha
Depois: (a lógica cai naturalmente no fallback de verificação de data)
```

## Arquivo
| Arquivo | Alteração |
|---|---|
| `src/hooks/useFinancialStatus.ts` | Remover linha 17 (`if (statusLower === 'pendente') return 'pendente'`) |

Nenhum outro arquivo precisa ser alterado — todos já consomem `calculateFinancialStatus` e se beneficiam automaticamente.

