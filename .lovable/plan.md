

## Plano: Relatório Executivo de Reunião — Design Premium de Última Geração

### Problema
O relatório atual (`MeetingPrintReport.tsx`) usa `cloneNode` para copiar SVGs do Recharts para uma janela de impressão, mas os gráficos ficam **vazios** porque SVGs do Recharts não se renderizam corretamente quando clonados. Além disso, o design é genérico e pouco impactante.

### Solução
Reescrever completamente o `MeetingPrintReport.tsx` com um design **HTML/CSS puro** (sem Recharts) que renderiza diretamente na janela de impressão, garantindo que tudo apareça. Os gráficos serão substituídos por **barras CSS animadas**, **indicadores visuais** e **cards estilizados** que funcionam 100% em print.

### Mudanças em `src/components/meetings/MeetingPrintReport.tsx`

#### Design Premium:
- **Header**: Gradiente sofisticado com logo, título, data, duração e badge de status
- **KPI Cards**: 4 cards com ícones CSS, valores grandes e labels — cores por tipo (azul/verde/laranja/vermelho)
- **Distribuição de Insights**: Barras horizontais CSS coloridas com labels e contadores (substitui PieChart vazio)
- **Status de Tarefas**: Barras horizontais CSS com cores por status (substitui PieChart vazio)
- **Riscos por Severidade**: Barras horizontais CSS com gradientes vermelho/laranja/amarelo/verde
- **Riscos por Departamento**: Tabela estilizada com barras de progresso CSS
- **Radar de Performance**: Substituído por scorecard visual com barras radiais CSS (5 dimensões)
- **Resumo Executivo**: Bloco com borda lateral gradiente e tipografia premium
- **Insights Detalhados**: Lista com cards coloridos por tipo e badges de impacto
- **Tarefas**: Lista com indicadores de prioridade e status
- **Riscos**: Cards com borda lateral colorida por severidade + ação recomendada
- **Rodapé**: Marca d'água sutil "BI Master" com timestamp

#### Técnica:
- Zero dependência de Recharts no print — tudo é HTML/CSS inline
- Gráficos são barras CSS com `width: ${percentage}%` e transições
- Funciona 100% em `window.print()` e exportação PDF
- Layout responsivo A4 com `page-break-inside: avoid`
- Paleta corporativa: azul profundo (#1e3a5f), roxo (#6366f1), gradientes premium

### Arquivo alterado
- `src/components/meetings/MeetingPrintReport.tsx` (reescrita completa)

