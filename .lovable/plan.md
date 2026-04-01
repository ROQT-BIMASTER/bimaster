

# Profissionalizar Home Pessoal (Página Inicial de Projetos)

## Diagnóstico

A página atual tem: saudação simples, lista flat de tarefas com seções colapsáveis, sidebar com projetos + card de métricas básico (4 números). Layout funcional mas visualmente pobre comparado ao Asana.

## Melhorias Propostas

### 1. KPIs Premium no Topo
- Substituir o card de métricas simples por uma strip de `KpiCard` (componente já existente) com ícones coloridos
- Métricas: Pendentes, Atrasadas, Concluídas Hoje, Produtividade Semanal (%) com progress ring SVG
- Usar variantes de cor (info, destructive, success, warning)

### 2. Seção "Próximas Tarefas" com Cards Ricos
- Substituir a lista flat por cards com barra lateral colorida (cor do projeto), badge de prioridade, ícone de status
- Mostrar apenas as 5 mais urgentes (atrasadas + hoje) com botão "Ver todas" → Minhas Tarefas
- Hover com elevação e transição suave

### 3. Atalhos Rápidos (Quick Actions)
- Botões de ação: "+ Nova Tarefa", "Ver Inbox", "Minhas Tarefas"
- Grid de atalhos contextuais logo abaixo da saudação

### 4. Sidebar Direita Enriquecida
- **Meus Projetos**: Manter mas adicionar badge de tarefas atrasadas em vermelho, status tag (Ativo/Pausado)
- **Atividade Recente**: Nova seção mostrando últimas 5 atividades do usuário (comentários, tarefas concluídas) puxadas de `projeto_atividades`
- **Agenda do Dia**: Mini-calendário mostrando tarefas com prazo hoje/amanhã

### 5. Empty State Premium
- Quando sem tarefas: ilustração SVG maior, sugestões contextuais ("Crie sua primeira tarefa", "Explore seus projetos")
- Botão CTA direto para criar tarefa

### 6. Animações e Polish
- Fade-in-up nos cards ao carregar
- Skeleton shimmer durante loading (já existe o componente)
- Saudação com emoji contextual (☀️ manhã, 🌤️ tarde, 🌙 noite)

## Alterações Técnicas

| Arquivo | Ação |
|---------|------|
| `ProjetoHome.tsx` | Refatorar completo: KPIs no topo, quick actions, cards ricos, atividade recente |
| Novo: `ProjetoHomeKPIs.tsx` | Strip de KPIs com progress ring semanal |
| Novo: `ProjetoHomeAtividades.tsx` | Feed de atividade recente do usuário |
| Novo: `ProjetoHomeQuickActions.tsx` | Grid de atalhos rápidos |
| `useMeusProjetosRecentes.ts` | Sem alteração |
| `useMinhasTarefas.ts` | Sem alteração |

Nenhuma migration necessária — usa dados já existentes nas tabelas `projeto_tarefas`, `projeto_atividades` e `projetos`.

