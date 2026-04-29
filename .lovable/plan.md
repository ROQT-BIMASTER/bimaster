## Causa do piscar

Na Central de Trabalho (`/dashboard/projetos/central`), o componente `MinhasTarefasContent.tsx` usa o badge "Sem datas" dentro de um `TooltipTrigger asChild`:

```tsx
<TooltipTrigger asChild>
  <Badge variant="outline" ...>
    <CalendarOff /> Sem datas
  </Badge>
</TooltipTrigger>
```

O Radix `TooltipTrigger asChild` injeta um `ref` no filho via `Slot`. Porém, o `Badge` em `src/components/ui/badge.tsx` é um function component **sem `forwardRef`**, então o ref é descartado.

Resultado:
1. Console enche de warnings "Function components cannot be given refs" (visível nos logs).
2. O Popper do Radix não consegue medir corretamente o trigger e tenta recalcular posições a cada render do parent.
3. A lista `MinhasTarefasContent` re-renderiza com frequência (React Query + 44 tarefas "sem prazo"), e cada render dispara nova tentativa de medição → tela piscando.

Isso provavelmente quebrou na última versão porque o `MinhasTarefasContent` (ou esse trecho do tooltip + badge "Sem datas") foi adicionado/alterado recentemente — nas versões anteriores nenhum consumidor passava ref para o `Badge`.

## Correção

### 1. `src/components/ui/badge.tsx` — converter para `forwardRef`

```tsx
const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  ),
);
Badge.displayName = "Badge";
```

Isso elimina o warning, faz o Radix posicionar o tooltip corretamente uma única vez e estabiliza a árvore — o piscar para.

### 2. Validação

- Recarregar `/dashboard/projetos/central` e confirmar que:
  - Não há mais warning "Function components cannot be given refs" no console.
  - O tooltip do badge "Sem datas" abre normalmente e a tela não pisca.
- Verificar visualmente as outras telas que usam `Badge` (Trade, Fábrica, Kanban) — a mudança é retrocompatível, só adiciona suporte a ref.

## Escopo

Mudança mínima e isolada em **um único arquivo de UI** (`src/components/ui/badge.tsx`). Sem alterações de regra de negócio, RLS, edge functions ou dados.
