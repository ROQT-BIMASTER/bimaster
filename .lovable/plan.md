

# Gráfico Único Full-Width com Tabs de Análise

## Conceito

Substituir o grid de 3 cards separados por **1 único Card full-width** com botões de alternância no topo. Cada botão troca a visualização dentro do mesmo container, mantendo o layout limpo e aproveitando toda a largura.

## Layout

```text
┌──────────────────────────────────────────────────────┐
│  [Por Tipo de Ação]  [Por Status]  [Por Prioridade]  │  ← ChartTabs buttons
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │                                                  ││
│  │         Gráfico ativo (full-width, h=300)        ││
│  │                                                  ││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

## Alterações

| Arquivo | Mudança |
|---|---|
| `src/components/financeiro/MetasReducaoChart.tsx` | Envolver os 3 gráficos no componente `ChartTabs` existente (`src/components/ui/chart-tabs.tsx`). Remover o grid de cards. Um único `Card` full-width contém os tabs + o gráfico ativo. Altura do gráfico aumenta para 320px (mais espaço horizontal). |

### Tabs definidos:
1. **Por Tipo de Ação** — BarChart vertical (Meta vs Realizado), ícone `BarChart3`
2. **Por Status** — PieChart donut (distribuição), ícone `PieChart` (lucide)
3. **Por Prioridade** — BarChart horizontal (Meta vs Realizado), ícone `Layers`

Reutiliza `ChartTabs` do design system — zero componentes novos.

