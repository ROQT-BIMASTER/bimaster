

# Redesign Profissional dos Gráficos de Metas de Redução

## Problema

O componente `MetasReducaoChart.tsx` usa cores hardcoded (`#f97316`, `#22c55e`, `#eab308`, etc.) que violam o design system e produzem um visual amador. Os gráficos carecem de polish (tooltips básicos, labels cortados no donut, sem gradientes).

## Alterações em `src/components/financeiro/MetasReducaoChart.tsx`

### 1. Cores — Migrar para design tokens
- Substituir todas as cores hardcoded pelos tokens de `chartColors` (`src/lib/chart-colors.ts`)
- Meta → `chartColors.primary` (azul), Realizado → `chartColors.success` (verde)
- Status: pendente → `chartColors.warning`, em andamento → `chartColors.accent`, concluído → `chartColors.success`, cancelado → `chartColors.destructive`
- Tipo de ação: usar `chartPalette` sequencial

### 2. Gráfico de Barras (Meta vs Realizado por Tipo)
- Aplicar gradientes sutis via `<defs><linearGradient>`
- Tooltip com `background: hsl(var(--card))`, `border: hsl(var(--border))`, border-radius 8
- Eixos com `stroke: hsl(var(--muted-foreground))`
- Grid com `stroke: hsl(var(--border))`

### 3. Donut (Distribuição por Status)
- Labels externos com linhas conectoras (`labelLine={true}`)
- Cores do design system em vez de hardcoded
- Adicionar legenda abaixo do donut

### 4. Barras Horizontais (Por Prioridade)
- Mesma paleta Meta/Realizado (primary/success)
- Gradientes consistentes com o gráfico vertical

### 5. Estilo geral
- `CartesianGrid` com `stroke="hsl(var(--border))"` em todos
- Tick fontSize 11, stroke muted-foreground (padrão do projeto)
- Tooltip contentStyle padronizado com card background

## Arquivo Alterado

| Arquivo | Mudança |
|---|---|
| `src/components/financeiro/MetasReducaoChart.tsx` | Substituir cores hardcoded por design tokens, melhorar tooltips, labels e gradientes |

