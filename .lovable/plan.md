

# Profissionalizar "Minhas Tarefas" — Nível Asana

## Diagnóstico

A página atual é funcional mas básica: header simples, cards sem detalhes ricos, sem drag-and-drop no quadro, calendário mostra apenas 7 dias, sem subtarefas, sem painel de detalhe lateral, sem métricas de produtividade.

## Melhorias Propostas

### 1. Header Premium com KPIs Visuais
- Strip de métricas: "12 pendentes", "3 atrasadas", "5 concluídas hoje", "85% produtividade semanal"
- Cards com ícones coloridos e micro-trends (seta ↑↓)
- Saudação contextual (Bom dia, Boa tarde) com nome do usuário

### 2. Painel de Detalhe Lateral (Sheet)
- Ao clicar numa tarefa, abrir side-sheet com detalhes completos em vez de navegar para o projeto
- Mostrar: título editável inline, descrição, subtarefas, comentários, histórico de atividade, anexos
- Botões de ação: alterar status, prioridade, prazo, responsável
- Botão "Abrir no projeto" para navegação completa

### 3. Quadro com Drag-and-Drop
- Implementar arrastar tarefas entre colunas (Atrasadas → Hoje → A fazer → Concluídas)
- Atualizar status/prazo automaticamente ao mover
- Feedback visual durante o arraste (sombra, placeholder)

### 4. Calendário Mensal Completo
- Substituir a visão semanal por calendário mensal navegável (← Maio 2026 →)
- Dots coloridos por projeto nos dias com tarefas
- Clique no dia para expandir lista de tarefas
- Mini-popover com detalhes ao hover

### 5. Filtros Avançados e Agrupamento
- Filtro por projeto (multi-select com cores)
- Filtro por status (pendente, em progresso, concluída)
- Toggle de agrupamento: por prazo (atual), por projeto, por prioridade
- Salvar filtros no localStorage

### 6. Ações em Lote
- Checkbox de seleção múltipla nas tarefas
- Barra flutuante: "Concluir selecionadas", "Alterar prioridade", "Mover prazo"
- Select all / deselect

### 7. Empty States e Micro-interações
- Animações fade-in-up ao carregar tarefas
- Confetti sutil ao concluir tarefa (opcional)
- Empty states com ilustrações SVG por visão
- Skeleton loading premium (shimmer)

### 8. Progress Ring Semanal
- Anel circular mostrando % de tarefas concluídas na semana
- Meta visual (ex: "7 de 10 concluídas esta semana")

## Alterações Técnicas

| Arquivo | Ação |
|---------|------|
| `MinhasTarefas.tsx` | Refatorar header com KPIs, adicionar filtros avançados, ações em lote |
| Novo: `MinhasTarefaDetail.tsx` | Sheet lateral com detalhes completos da tarefa |
| Novo: `MinhasTarefasBoard.tsx` | Quadro com drag-and-drop (dnd-kit ou similar via HTML5) |
| Novo: `MinhasTarefasCalendar.tsx` | Calendário mensal navegável |
| Novo: `MinhasTarefasKPIs.tsx` | Strip de métricas com progress ring |
| `useMinhasTarefas.ts` | Adicionar métricas calculadas (produtividade, trends) |

## Resultado
Experiência visual e funcional equivalente ao Asana: painel de detalhe sem sair da página, drag-and-drop no quadro, calendário mensal, KPIs de produtividade e filtros avançados.

