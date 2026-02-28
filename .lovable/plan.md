

# Dashboard Admin com Botão Separado e Gráfico Profissional

## O que muda

1. **Botão separado no header** — O dashboard admin fica oculto por padrão. Um botão "Painel Administrativo" no header da página abre/fecha a seção com animação suave (estado toggle com `useState`).

2. **Gráfico de distribuição de revisões** — Adicionar um gráfico de barras horizontal (Recharts `BarChart`) ou gráfico de rosca (`PieChart`) mostrando a distribuição de status das revisões (Pendentes, Em Análise, Aprovadas, Reprovadas) com cores temáticas. Será posicionado ao lado dos alertas rápidos na linha 2, reorganizando o layout para 3 colunas: Revisões Solicitadas | Gráfico | Alertas.

## Implementação

### Arquivo: `src/pages/FabricaProdutosAcabados.tsx`
- Adicionar estado `showAdminDash` (boolean, default `false`)
- Adicionar botão "Painel Administrativo" com ícone `BarChart3` no header ao lado dos outros botões
- Renderizar `ProdutosAcabadosAdminDashboard` condicionalmente com `showAdminDash`
- Envolver em `Collapsible` do Radix para animação

### Arquivo: `src/components/fabrica/ProdutosAcabadosAdminDashboard.tsx`
- Adicionar gráfico de rosca (Recharts `PieChart` + `Pie` + `Cell`) com os 4 status de revisão
- Cores: vermelho (pendentes), azul (em análise), verde (aprovadas), laranja (reprovadas)
- Usar `ChartContainer` e `ChartTooltip` já existentes em `@/components/ui/chart`
- Reorganizar layout linha 2 para `md:grid-cols-5`: Revisões (col-span-2) | Gráfico (col-span-1) | Alertas (col-span-2) — ou manter 3 colunas com gráfico substituindo espaço dos alertas

### Dados do gráfico
- Reutilizar o `kpis` já calculado (pendentes, emAnalise, aprovadas, reprovadas) — sem query adicional

