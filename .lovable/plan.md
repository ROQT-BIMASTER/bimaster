## Objetivo
Enriquecer o card "Displays / Master" mostrando a fórmula completa de forma legível, incluindo:
- Valor bruto do campo `Display` (ex.: `"36IN1"`)
- Valor parseado (ex.: `36`)
- Valor de `qty_per_display` usado (ex.: `432`)
- Resultado da divisão e seu significado

## Arquivo afetado
- `src/components/china/ChinaDataValidationDialog.tsx` (linhas 356–372)

## Mudança

Substituir o conteúdo atual do card por um layout em 3 partes:

1. **Header**: rótulo bilíngue "Displays / Master 每箱展示数".
2. **Resultado grande**: valor de `displaysPerMaster` (ou `—`).
3. **Bloco de fórmula** (novo): exibe a equação detalhada em uma "pílula" visual com tipografia mono, mostrando:
   - `QTY/Display (qty_per_display)` ÷ `Display parseado (raw → unit)` = resultado
   - Exemplo renderizado: `432 ÷ 36 ("36IN1") = 12 displays/master`

```tsx
<div className="p-3 bg-accent/30 rounded-lg border border-accent space-y-2">
  <Label className="text-xs font-semibold">Displays / Master 每箱展示数</Label>

  <div className="text-2xl font-bold leading-none">
    {displaysPerMaster > 0
      ? (Number.isInteger(displaysPerMaster)
          ? displaysPerMaster.toLocaleString()
          : displaysPerMaster.toFixed(2))
      : "—"}
  </div>

  {qtyPerDisplay && displayUnit ? (
    <div className="rounded-md bg-background/60 border border-border/60 px-2 py-1.5 font-mono text-[10px] leading-snug text-muted-foreground space-y-0.5">
      <div>
        <span className="text-foreground font-semibold">{qtyPerDisplay.toLocaleString()}</span>
        <span className="opacity-60"> (QTY/Display)</span>
        <span className="px-1">÷</span>
        <span className="text-foreground font-semibold">{displayUnit}</span>
        <span className="opacity-60"> (Display: "{data.display_type}")</span>
      </div>
      <div>
        = <span className="text-foreground font-semibold">
          {Number.isInteger(displaysPerMaster)
            ? displaysPerMaster.toLocaleString()
            : displaysPerMaster.toFixed(2)}
        </span> displays / master
      </div>
    </div>
  ) : (
    <p className="text-[10px] text-muted-foreground">
      Preencha QTY por Display e Display (ex.: 36IN1) para ver a fórmula.
    </p>
  )}
</div>
```

## Comportamento
- Quando faltar dado: card mostra `—` e instrução textual.
- Quando o valor parseado for igual ao bruto (ex.: usuário digitou apenas "36"), a "pílula" continua mostrando ambos consistentemente.
- Sem alterações de dados ou fluxo de save.
