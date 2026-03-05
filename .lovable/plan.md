

## Plan: Reverse Price Calculation (Goal Seek) in the Price Matrix

### What will be built

A feature that allows clicking on a price cell in the Matrix, entering a desired final price, and having the system reverse-calculate the required markup override to achieve that price. The system will:

1. Show the current cost base and current price
2. Accept a new desired price input
3. Reverse-calculate the markup (percentual) needed: `markup = ((precoDesejado / custoBase) - 1) * 100`
4. Save it as a product-level override in `fabrica_markup_overrides`
5. Refresh the matrix to reflect the new price

### Technical approach

**New component: `ReversePrecoDialog.tsx`**
- A dialog that opens when user double-clicks (or via context menu) on a price cell
- Shows: product name, table name, current cost base, current price, current markup
- Input field for the desired new price
- Auto-calculates and displays the implied markup (percentual, multiplicador, or valor_fixo) in real-time as user types
- Shows the resulting margin preview
- "Salvar" button that upserts a product-level override in `fabrica_markup_overrides`

**Edit: `MatrizPrecosComparativa.tsx`**
- Add a new handler `handlePrecoEdit` triggered by double-click on price cells
- Pass cost base, current price, product ID, table ID, and table's markup type to the dialog
- On save, invalidate the prices query to refresh the matrix
- Add visual indicator (e.g., small edit icon on hover) to show cells are editable

**Edit: `pricing-calculator.ts`**
- Add reverse calculation functions:
  - `reverseMarkupPercentual(custo, precoDesejado)` → returns percentage
  - `reverseMarkupMultiplicador(custo, precoDesejado)` → returns multiplier
  - `reverseMarkupValorFixo(custo, precoDesejado)` → returns fixed value

### Reverse calculation logic

```text
Given: custoBase, precoDesejado, tipoMarkup

Percentual:  markup = ((precoDesejado / custoBase) - 1) * 100
Multiplicador: markup = precoDesejado / custoBase
Valor Fixo:  markup = precoDesejado - custoBase
```

### UI flow

```text
1. User double-clicks a price cell in the matrix
2. Dialog opens showing:
   ┌──────────────────────────────────┐
   │ Ajustar Preço — [Produto]       │
   │ Tabela: [Nome da Tabela]        │
   ├──────────────────────────────────┤
   │ Custo Base:     R$ 45,00        │
   │ Preço Atual:    R$ 67,50        │
   │ Markup Atual:   +50%            │
   │                                  │
   │ Novo Preço: [___R$ 72,00___]    │
   │                                  │
   │ → Markup calculado: +60.0%      │
   │ → Margem resultante: 37.5%      │
   │                                  │
   │        [Cancelar]  [Salvar]     │
   └──────────────────────────────────┘
3. System upserts override in fabrica_markup_overrides
4. Matrix refreshes with new price
```

### Files summary
- **Create** `src/components/fabrica/ReversePrecoDialog.tsx` — dialog with reverse calc UI
- **Edit** `src/lib/fabrica/pricing-calculator.ts` — add reverse calculation functions
- **Edit** `src/components/fabrica/MatrizPrecosComparativa.tsx` — add double-click handler and dialog integration

