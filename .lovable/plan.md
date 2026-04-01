

# Melhorar Calendário de Minhas Tarefas

## Problemas Atuais

- Calendário vazio parece sem vida (grid de células vazias sem contexto)
- Sem botão "Hoje" para voltar rapidamente ao mês atual
- Sem resumo mensal (quantas tarefas no mês, concluídas, atrasadas)
- Células não têm posição `relative` (o indicador de atraso com `absolute` não funciona)
- Sem legenda de cores dos projetos
- Popover funcional mas sem opção de concluir tarefa direto do calendário
- Sem distinção visual entre dias úteis e fins de semana
- Navegação básica (só setas, sem mini-strip de meses)

## Melhorias Propostas

### 1. Header Enriquecido
- Botão "Hoje" entre as setas de navegação para voltar ao mês atual
- Mini-resumo ao lado do título: "8 tarefas · 2 atrasadas"
- Título maior e mais destacado

### 2. Células Visuais Melhoradas
- Adicionar `relative` nas células (fix do indicador de atraso)
- Fins de semana com background sutil diferente (bg-muted/20)
- Dia de hoje com badge circular no número (como Google Calendar)
- Hover mais expressivo com sombra e scale sutil
- Altura mínima maior para melhor leitura

### 3. Legenda de Projetos
- Strip de chips coloridos abaixo do header mostrando os projetos presentes no mês
- Clicável para filtrar tarefas de um projeto específico

### 4. Popover Melhorado
- Checkbox para concluir tarefa direto do popover (sem precisar abrir detalhe)
- Badge de prioridade com cores (urgente, alta, normal)
- Mostrar horário se disponível
- Separador visual entre tarefas concluídas e pendentes

### 5. Empty State do Mês
- Quando o mês não tem tarefas, mostrar mensagem centralizada no grid: "Nenhuma tarefa neste mês"
- Sugestão para criar tarefa

### 6. Mini-stats do Mês
- Barra sutil abaixo do calendário: "Abril: 12 tarefas · 8 concluídas · 2 atrasadas · 2 pendentes"

## Alterações Técnicas

| Arquivo | Ação |
|---------|------|
| `MinhasTarefasCalendar.tsx` | Refatorar com header premium, fix relative, legenda, popover melhorado, empty state, mini-stats |

Zero migrations. Apenas refinamento visual do componente existente.

