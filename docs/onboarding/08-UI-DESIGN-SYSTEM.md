---
title: UI / Design System
audience: ai-coding-agent
last_updated: 2026-05-02
---

# 08 — UI / Design System

## Regra-mãe

> **Nunca use cores literais em componentes** (`bg-white`, `text-black`,
> `bg-[#fff]`, `#hex`, `rgb(...)`). Sempre tokens semânticos.

## Tokens

Definidos em `src/index.css` (CSS variables HSL) e `tailwind.config.ts`
(mapeamento Tailwind). Sempre **HSL sem `#`, sem `rgb()`**.

```css
/* src/index.css */
:root {
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --primary: 222 47% 11%;
  --primary-foreground: 210 40% 98%;
  --muted: 210 40% 96%;
  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;
  --border: 214 32% 91%;
  /* gradientes/sombras como tokens */
  --gradient-primary: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)));
  --shadow-elegant: 0 10px 30px -10px hsl(var(--primary) / 0.3);
}
.dark { /* … overrides … */ }
```

```ts
// tailwind.config.ts mapeia para classes:
colors: {
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
  primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
  muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
  card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
  border: "hsl(var(--border))",
}
```

## Uso correto

```tsx
// BOM
<div className="bg-card text-card-foreground border border-border rounded-xl">
  <h2 className="text-foreground">Título</h2>
  <p className="text-muted-foreground">Subtítulo</p>
  <Button variant="default">Ação</Button>
</div>

// RUIM
<div className="bg-white text-black border border-gray-200">  ❌
<button style={{ background: "#3B82F6" }}>...                 ❌
```

## Componentes shadcn

- Em `src/components/ui/` (gerados via `components.json`).
- Customize via **variants** (`cva`):

```tsx
import { cva } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        premium: "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-elegant",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);
```

## Padrões por módulo

### Trade Marketing

- Tema rosa `#E91E78` (via token `--trade-primary`).
- **Bordas 16px** em cards.
- Banners proporção **3:1**.
- Memória: `mem://architecture/trade-marketing-standards-consolidated`.

### Fábrica — Ficha de Análise

- **Focus Mode** densidade alta: fontes 10–11px, padding mínimo, linhas justas.
- Painel esquerdo colapsável no Catálogo.
- Memória: `mem://features/fabrica/ficha-analise-focus-mode-standards`,
  `mem://features/fabrica/product-catalog-visibility-logic`.

### Projetos

- Largura total, grids redimensionáveis (`react-resizable-panels`).
- KPI strip no topo (`bg-card/70 backdrop-blur-sm`).
- Filtros ativos como chips removíveis.
- Densidade compact/comfortable via `useTarefaDensity` (persistido em
  `localStorage`).
- Atalho `/` foca o quick search.
- Fundo de página configurável via `usePageBgColor`.
- Memória: `mem://features/projects/visual-and-functional-standards-v2`.

### Fundo de página configurável

```ts
// src/hooks/usePageBgColor.ts (ver arquivo real)
const { color, setColor } = usePageBgColor("projetos:home");
```

Memória: `mem://ui/page-bg-customizer-pattern`.

### Command palette

- Atalho global `Cmd/Ctrl+K`.
- Indexa rotas + ações comuns.
- Memória: `mem://ui/command-palette-and-navigation-indexing`.

## Tipografia

- Headings: variant `font-semibold` ou `font-bold`, `tracking-tight`.
- Body: `text-sm` ou `text-base`.
- Código: `font-mono`.
- Sem fontes serifas a menos que pedido explícito.

## Acessibilidade

- Sempre `aria-label` em ícones-só-clicáveis.
- `Label` associado a `Input` via `htmlFor`/`id`.
- Foco visível (`focus-visible:ring-2 focus-visible:ring-ring`).
- Helpers em `src/lib/utils/accessibility.ts`.
- Doc: `ACESSIBILIDADE_CORRIGIDA.md` (raiz).

## Toasts

```ts
import { toast } from "sonner";
toast.success("Salvo");
toast.error(error.userMessage);  // sempre userMessage do invokeChat
toast.info("Sincronizando…");
```

## Diálogos / confirmação

- `Dialog` (shadcn) para forms.
- `AlertDialog` para confirmações destrutivas.
- `PasswordConfirmDialog` (`src/components/dre/PasswordConfirmDialog.tsx`) para
  reauth em ações de copilot/Sofia.

## Tabelas

- Pequenas: `Table` shadcn.
- Grandes (>200 linhas): `VirtualizedTable`
  (`src/components/common/VirtualizedTable.tsx`) ou `InfiniteScrollList`.

## Charts

- `recharts`. Cores via tokens (use `src/lib/chart-colors.ts`).
- Tooltips e legendas em PT-BR.
- Sempre `ResponsiveContainer`.

## Currency / number / date display

```ts
import { formatCurrency } from "@/lib/formatters";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

formatCurrency(1234.5);                           // "R$ 1.234,50"
format(parseLocalDate("2026-05-02")!, "PPP", { locale: ptBR });
```
