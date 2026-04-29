## Objetivo
Adicionar um novo card na seção **Quantidades e Display** do `ChinaDataValidationDialog`, exibindo a quantidade de displays dentro de uma caixa master, calculada como:

```
QTY Displays/Master = qty_per_display ÷ Nº do Display
```

Onde "Nº do Display" é extraído do campo `display_type` (ex.: `"36IN1"` → `36`, `"24IN1"` → `24`).

## Arquivo afetado
- `src/components/china/ChinaDataValidationDialog.tsx`

## Mudanças

### 1. Helper para parsear o número do display
Adicionar perto dos demais memos (~linha 90):
```ts
const displayUnit = useMemo(() => {
  const raw = data.display_type || "";
  const match = raw.match(/(\d+)/); // pega o primeiro número (36IN1 → 36)
  return match ? parseInt(match[1]) : 0;
}, [data.display_type]);

const displaysPerMaster = useMemo(() => {
  if (!qtyPerDisplay || !displayUnit) return 0;
  return qtyPerDisplay / displayUnit;
}, [qtyPerDisplay, displayUnit]);
```

### 2. Novo card visual
Inserir como quarto card na grid de cards coloridos (após CTN/件, ~linha 344). Mudar a grid para `md:grid-cols-4` ou manter `md:grid-cols-3` e colocar o novo card como linha extra. Estilo coerente com os existentes (rounded, borda colorida, ícone de cor distinta — usar tom `accent` ou `info`).

```tsx
<div className="p-3 bg-accent/30 rounded-lg border border-accent">
  <Label className="text-xs font-semibold">
    Displays / Master 每箱展示数
  </Label>
  <div className="h-9 flex items-center mt-1">
    <span className="text-lg font-bold">
      {displaysPerMaster > 0
        ? Number.isInteger(displaysPerMaster)
          ? displaysPerMaster.toLocaleString()
          : displaysPerMaster.toFixed(2)
        : "—"}
    </span>
  </div>
  <p className="text-[10px] text-muted-foreground mt-1">
    {qtyPerDisplay && displayUnit
      ? `${qtyPerDisplay} ÷ ${displayUnit} = QTY Display dentro da Master`
      : "Preencha QTY por Display e Display (ex.: 36IN1)"}
  </p>
</div>
```

### 3. Layout
Trocar a primeira grid `grid-cols-2 md:grid-cols-3` (linha 309) por `grid-cols-2 md:grid-cols-4` para acomodar o quarto card sem quebrar.

## Comportamento
- Card é **read-only** (apenas exibe o cálculo).
- Mostra "—" e instrução quando faltar dado.
- Aceita resultado fracionário (formata com 2 casas) caso a divisão não seja exata, alertando indiretamente que algo está inconsistente.
- Não altera a estrutura de dados nem o salvamento.

## Resultado esperado
Para o exemplo do print: `qty_per_display=432`, `display_type="36IN1"` → card mostra **12** com legenda `432 ÷ 36 = QTY Display dentro da Master`.
