

# Botão "Colunas" — Sempre visível no fundo escuro

## Problema
O botão "Colunas" usa `variant="outline"` que tem texto escuro, ilegível contra o header escuro do projeto. Só fica visível ao passar o mouse.

## Solução
Em `ColumnConfigPopover.tsx`, usar a prop `darkBg` (já existente mas não utilizada) para aplicar classes que mantenham o botão sempre com fundo e texto visíveis — estilo similar ao hover permanente: fundo `bg-accent` com `text-accent-foreground` e borda clara.

## Alteração

**`src/components/projetos/ColumnConfigPopover.tsx`** — Na linha do `<Button>`, adicionar classes condicionais baseadas em `darkBg`:

```tsx
className={cn(
  "h-8 text-xs gap-1.5",
  darkBg && "bg-accent text-accent-foreground border-accent",
  className
)}
```

Isso garante que no header escuro o botão sempre mostre com a cor de hover, sem precisar passar o mouse.

| Arquivo | Alteração |
|---|---|
| `src/components/projetos/ColumnConfigPopover.tsx` | Aplicar classes de contraste quando `darkBg=true` |

