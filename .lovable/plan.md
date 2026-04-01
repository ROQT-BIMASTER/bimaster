

# Manuais Interativos em Todas as Telas de Projetos

## Escopo

Criar tours interativos (driver.js) para as **6 telas principais** do módulo de Projetos que ainda não possuem manual:

| Tela | Tour ID | Qtd Steps |
|------|---------|-----------|
| **Home Pessoal** (`ProjetoHome.tsx`) | `projeto-home` | ~8 |
| **Minhas Tarefas** (`MinhasTarefas.tsx`) | `minhas-tarefas` | ~10 |
| **Caixa de Entrada** (`ProjetoInbox.tsx`) | `projeto-inbox` | ~8 |
| **Lista de Projetos** (`Projetos.tsx`) | `projeto-lista` | ~6 |
| **Detalhe do Projeto** (`ProjetoDetalhe.tsx`) | `projeto-detalhe` | ~10 |
| **Minha Equipe** (`ProjetosMinhaEquipe.tsx`) | `projetos-equipe` | ~5 |

## O que cada tour cobre (detalhado)

### Home Pessoal
- Saudação e contexto do dia
- KPIs de produtividade (tarefas pendentes, concluídas, atrasadas)
- Quick Actions (atalhos rápidos)
- Lista de tarefas agrupadas por prazo
- Card "Meus Projetos" com progresso
- Feed de atividades recentes

### Minhas Tarefas
- KPIs do topo (total, concluídas, atrasadas, pendentes)
- Visões: Lista, Quadro Kanban, Calendário (como alternar)
- Filtros por projeto e busca
- Criar nova tarefa (botão + dialog)
- Marcar tarefa como concluída (checkbox)
- Painel de detalhe lateral (clicar na tarefa)
- Agrupamento temporal (Hoje, Esta Semana, Próxima Semana)
- Seleção múltipla e ações em lote

### Caixa de Entrada
- KPIs (não lidas, menções, favoritas, hoje)
- Tabs: Atividade, Menções, Favoritas, Arquivadas
- Filtros por tipo de atividade (chips)
- Filtro por projeto
- Agrupamento (tempo vs projeto)
- Ações nos cards (marcar lida, favoritar, arquivar)
- Seleção múltipla e "Marcar todas como lidas"

### Lista de Projetos
- Visão geral de todos os projetos
- Criar novo projeto (botão +)
- Status e progresso de cada projeto
- Membros da equipe
- Menu de ações (finalizar, excluir)

### Detalhe do Projeto
- Header com nome, status e cor de fundo
- Tabs de trabalho: Lista, Quadro, Cronograma, Calendário
- Tabs de gestão: Painel, Briefings, Equipe, Arquivos
- Filtros e ordenação de tarefas
- Criar tarefa inline
- Seções e agrupamentos
- Lixeira (tarefas excluídas)

### Minha Equipe
- Árvore de equipe
- Métricas por membro
- Tarefas atribuídas

## Implementação Técnica

### Novos arquivos (6 tour definitions)
- `src/components/tour/tours/projetoHomeTour.ts`
- `src/components/tour/tours/minhasTarefasTour.ts`
- `src/components/tour/tours/projetoInboxTour.ts`
- `src/components/tour/tours/projetosListaTour.ts`
- `src/components/tour/tours/projetoDetalheTour.ts`
- `src/components/tour/tours/projetosEquipeTour.ts`

### Arquivos editados (7)
- `src/components/tour/index.ts` — exportar os 6 novos tours
- `src/pages/ProjetoHome.tsx` — adicionar `data-tour` attrs + `TourButton`
- `src/pages/MinhasTarefas.tsx` — adicionar `data-tour` attrs + `TourButton`
- `src/pages/ProjetoInbox.tsx` — adicionar `data-tour` attrs + `TourButton`
- `src/pages/Projetos.tsx` — adicionar `data-tour` attrs + `TourButton`
- `src/pages/ProjetoDetalhe.tsx` — adicionar `data-tour` attrs + `TourButton`
- `src/pages/ProjetosMinhaEquipe.tsx` — adicionar `data-tour` attrs + `TourButton`

### Padrão
Cada tour segue o padrão existente:
1. Arquivo `.ts` com `DriveStep[]` usando `element: '[data-tour="..."]'`
2. `TourButton` fixo (bottom-right) na página
3. Atributos `data-tour="..."` nos elementos-alvo da página

Zero migrations. Apenas código frontend.

