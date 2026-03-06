

## Plano: Configuração de Seções + Exportação Excel com Formatação Premium

### Mudanças em `src/components/meetings/MeetingPrintReport.tsx`

#### 1. Modal de Configuração antes de imprimir/exportar
- Substituir o botão direto "Relatório PDF" por um **dropdown** com "Imprimir PDF" e "Exportar Excel"
- Ao clicar em qualquer opção, abrir um **Dialog** com checkboxes para o usuário escolher quais seções incluir:
  - Visão Geral (KPIs)
  - Análise Gráfica
  - Scorecard de Performance
  - Resumo Executivo
  - Insights Detalhados
  - Tarefas Identificadas
  - Riscos Identificados
- Todas marcadas por default; usuário desmarca o que não quer
- Botões "Imprimir PDF" e "Exportar Excel" no rodapé do dialog

#### 2. Ajuste A4 no CSS de impressão
- Adicionar `@page { size: A4 portrait; margin: 15mm 18mm; }` mais preciso
- Garantir `max-width: 210mm` no body para evitar overflow
- Melhorar `page-break-before: always` nas seções longas (Insights, Tarefas, Riscos)
- Ajustar font-sizes para caber melhor em A4

#### 3. Exportação Excel com formatação premium
- Usar `ExcelJS` (já instalado) para gerar workbook com múltiplas abas:
  - **Resumo**: KPIs + score + resumo executivo
  - **Insights**: tabela com tipo, título, descrição, impacto, departamento
  - **Tarefas**: tabela com tarefa, status, prioridade, departamento
  - **Riscos**: tabela com título, severidade, departamento, probabilidade, ação recomendada
- Aplicar formatação corporativa: header azul (#1a5276) com texto branco, bordas, larguras automáticas, filtros automáticos
- Gerar gráficos Excel nativos via `ExcelJS.chart` (barras de insights/tarefas) — se não suportado, incluir dados formatados que o usuário pode grafar facilmente
- Respeitar as seções selecionadas pelo usuário (só gera abas das seções marcadas)

### Arquivo alterado
- `src/components/meetings/MeetingPrintReport.tsx` (adicionar Dialog de config + lógica de export Excel)

