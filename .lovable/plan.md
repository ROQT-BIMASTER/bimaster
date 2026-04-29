## Problema

Na Central de Trabalho, com o filtro **"Sem prazo"** ativo:

1. O **Resumo da semana** mostra `0` em todas as métricas e o gráfico "Conclusões por dia" fica vazio/piscando.
2. O motivo: `ResumoSemanal` recebe a lista **já filtrada** (`filtered`), e o filtro "Sem prazo" remove toda tarefa que tenha `data_prazo` ou `data_conclusao` — exatamente o que o resumo precisa para calcular Concluídas, Planejadas e o sparkline.
3. O "piscar" do gráfico vem do `ResponsiveContainer` do Recharts re-medindo a cada re-render (dataset oscilando entre vazio/zerado, combinado com o `animate-pulse` do KPI "Sem prazo" que dispara reflow no grid de KPIs).
4. Bônus: warning recorrente do Radix `Tooltip → Badge` por ref ausente (precisa `React.forwardRef`) está agravando o ciclo de renders na lista.

## O que fazer

### 1. Desacoplar o Resumo da semana dos filtros de lente
Em `src/components/projetos/central/MinhasTarefasContent.tsx`:
- Trocar `<ResumoSemanal tarefas={filtered} ... />` por `<ResumoSemanal tarefas={tarefas} ... />`.
- O resumo continua respeitando o filtro de **projeto** (porque já é a base do conjunto pessoal). O escopo "semana" é fixo por desenho e não deve depender de `Sem prazo / Hoje / Atrasadas`.
- Aplicar o filtro de projeto ao resumo separadamente (recalcular um `tarefasParaResumo` que considera apenas `filterProject`, ignorando `filterTime`, `filterPriority` e `search`).

### 2. Estabilizar o gráfico (parar de piscar)
Em `src/components/projetos/central/ResumoSemanal.tsx`:
- Garantir altura fixa do contêiner do gráfico (já tem `h-[140px]`, manter) e adicionar `key` estável no `LineChart` baseado em `weekOffset` para evitar transições parciais quando o dataset muda.
- Remover o `animate-pulse` do KpiCard "Sem prazo" no estado normal, deixando-o apenas como destaque visual estático (`ring-1 ring-warning/30`) — em `src/components/projetos/central/CentralKPIs.tsx` (somente o caso `activeTab === "tarefas"` que está acima do Resumo). O pulse causa reflow do grid imediatamente acima do gráfico.
- Memoizar o `data.sparkline` como objeto estável quando vazio para evitar nova referência por render.

### 3. Acertar o warning do Radix Tooltip
Em `src/components/ui/badge.tsx`:
- Converter o componente `Badge` para `React.forwardRef<HTMLDivElement, BadgeProps>(...)`. Isso resolve o `Function components cannot be given refs` que aparece quando `Badge` é usado dentro de `Tooltip` em `ListRow`.

### 4. Mensagem de estado vazio coerente
No `ResumoSemanal`, quando após filtro de projeto não houver nenhuma tarefa com data na semana, mostrar mensagem inline ("Sem dados nesta semana — tente outra semana") em vez de exibir gráfico zerado, evitando a sensação de bug.

## Arquivos afetados (somente frontend)

- `src/components/projetos/central/MinhasTarefasContent.tsx` — passar `tarefas` (não `filtered`), aplicar somente filtro de projeto ao resumo.
- `src/components/projetos/central/ResumoSemanal.tsx` — `key` estável no LineChart, fallback de "sem dados na semana", micro-memoização.
- `src/components/projetos/central/CentralKPIs.tsx` — remover `animate-pulse` do card "Sem prazo".
- `src/components/ui/badge.tsx` — `forwardRef` para eliminar warning e re-renders extras.

## Fora do escopo

- Não alterar nenhum hook de dados, RPC ou lógica de negócio (`useMinhasTarefas`, `get_minhas_tarefas_central`).
- Não mexer na regra de visibilidade pessoal já consolidada.
