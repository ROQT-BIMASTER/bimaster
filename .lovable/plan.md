## Objetivo
Na Grade de Cores do diálogo de validação (China), cada grupo (G1, G2, …) representa uma **caixa**. A análise atual soma todas as cores e compara o total com `QTY/Caixa`, gerando falso erro (ex.: G1=36, G2=36, QTY/Caixa=36 → mostra "72 ≠ 36").

A regra correta: **cada grupo individualmente** deve ter soma igual a `qty_per_display`.

## Arquivo afetado
- `src/components/china/ChinaDataValidationDialog.tsx`

## Mudanças

### 1. Lógica de mismatch por grupo (linhas ~90-92, 207-213)
Substituir o cálculo único `colorSum vs qtyPerDisplay` por verificação por grupo, reaproveitando o `groupSummary` já existente:

```ts
const mismatchedGroups = useMemo(() => {
  if (!qtyPerDisplay) return [];
  return Object.entries(groupSummary)
    .filter(([_, qty]) => qty !== qtyPerDisplay)
    .map(([g, qty]) => ({ grupo: g, qty }));
}, [groupSummary, qtyPerDisplay]);

const hasMismatch = mismatchedGroups.length > 0;
```

### 2. Badges de resumo (linhas ~426-435)
Cada badge de grupo passa a indicar visualmente se aquele grupo bate ou não com `QTY/Caixa`:
- Verde/default quando `qty === qtyPerDisplay`
- Destrutivo quando difere

Manter o badge "Total" apenas como informação (sem cor de erro).

### 3. Mensagem de erro (linhas ~437-448)
Substituir o texto único por uma lista dos grupos divergentes, mostrando o cálculo apenas das cores daquele grupo:

```
G1 (40 pcs) difere de QTY/Caixa (36).
   Cálculo: 1: 8 + 2: 8 + 3: 8 + 4: 8 + 5: 8 = 40 · QTY/Caixa = 36
G2 (36 pcs) — OK
```

Texto bilíngue mantido: "颜色总量与每箱数量不匹配。" passa para "组X颜色总量与每箱数量不匹配。"

### 4. Comportamento mantido
- `colorSum` continua sendo exibido como total geral (informativo).
- `groupSummary` já existe — apenas reutilizado.
- Nada na lógica de salvamento/`onConfirm` muda; apenas a UI de validação.

## Resultado esperado
No exemplo do print: G1=36, G2=36, QTY/Caixa=36 → ambos OK, sem alerta vermelho. Total=72 aparece apenas como contagem total (sem cor destrutiva).
