# Correções: scroll horizontal cobrindo menu + contraste do badge "Em Revisão"

## Diagnóstico

### Problema 1 — Conteúdo passa por trás do menu lateral
No `DashboardLayout`, o `<main>` é `flex-1` mas **sem `min-w-0`**. Quando o conteúdo interno é largo (tabela com muitas colunas), o `<main>` se estica além do espaço disponível, gerando rolagem horizontal no nível raiz. O sidebar é `position: fixed z-10` à esquerda — ao rolar horizontalmente, o conteúdo desliza por baixo dele.

Adicionalmente, o `<header>` de 52px **não é sticky**, então some ao rolar verticalmente, e quando há scroll-x ele mesmo é arrastado.

### Problema 2 — Badge "Em Revisão" ilegível em tema escuro
O `StatusAprovacaoBadge` (em `src/components/fabrica/FichaAprovacaoBanner.tsx`) usa `variant="outline"` para o status `em_revisao` — esse variant herda `text-foreground` e borda neutra. Em fundos escuros customizados (preto via `PageBgCustomizer`), o badge fica branco-em-branco, sem contraste.

## Mudanças

### 1. `src/components/dashboard/DashboardLayout.tsx`
- `<main className="flex-1">` → `<main className="flex-1 min-w-0">` (impede o flex item de ultrapassar o container, eliminando rolagem horizontal global).
- `<header className="h-[52px] ...">` → `<header className="sticky top-0 z-30 h-[52px] ...">` (mantém o cabeçalho visível durante scroll, com z acima de tabelas e abaixo de modais/popovers).

Resultado: o scroll-x agora fica contido no `<div className="overflow-x-auto">` do conteúdo da página (já existente), sem afetar o layout global. O conteúdo nunca mais desliza por baixo do menu.

### 2. `src/components/fabrica/FichaAprovacaoBanner.tsx`
Adicionar classes explícitas amber (com variantes light/dark) ao badge "Em Revisão" e "Revisão Solicitada", garantindo contraste WCAG AA em qualquer fundo:

```ts
em_revisao: {
  ...
  badgeClass: "border-amber-500/60 bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/60",
},
revisao_solicitada: {
  ...
  badgeClass: "border-orange-500/60 bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-200 dark:border-orange-400/60",
},
```

E aplicar no `StatusAprovacaoBadge`:
```tsx
<Badge variant={cfg.variant} className={cn("gap-1 text-xs", cfg.badgeClass)}>
```

Como os tokens `--card`, `--foreground` etc são reescritos pela paleta derivada do `PageBgCustomizer`, classes amber/orange explícitas garantem leitura mesmo sob fundo preto.

## Garantias
- Sem migrações, sem mexer em RLS, dados, regras de filtro ou famílias de status.
- Mudanças puramente de CSS/markup.
- Build TS verificado ao final.

## Resumo
2 arquivos editados, 4 linhas de mudança efetiva. Resolve sobreposição do conteúdo com a sidebar em todo o sistema e melhora o contraste do badge "Em Revisão" em fundos escuros.