

## Plano: Filtro por Projeto na tela principal e no modo foco

### O que será feito

Adicionar um **Select de filtro por projeto** em dois locais:

1. **Tela principal** (`ProjetosMinhaEquipe`): abaixo dos KPIs, antes da hierarquia. Filtra os membros exibidos — mostra apenas membros que participam do projeto selecionado, recalculando KPIs e ranking.

2. **Modo foco** (`MemberDetailModal`): ao lado dos tabs de status na coluna direita. Filtra a lista de tarefas e o gráfico de evolução para mostrar apenas tarefas do projeto selecionado.

### Implementação

**Arquivo:** `src/pages/ProjetosMinhaEquipe.tsx`

#### Dados
- Nova query para buscar lista de projetos: `supabase.from("projetos").select("id, nome, cor")` — executada uma vez na página principal e passada como prop ao modal.

#### Tela principal
- Estado `projetoFilter: string | null` (null = todos)
- Select com ícone `FolderKanban` entre os KPIs e o grid hierarquia/ranking
- Quando um projeto é selecionado, filtrar `allMembers` para incluir apenas membros que participam daquele projeto (via `projeto_membros`). Nova query: `projeto_membros` filtrada por `projeto_id` para obter lista de `user_id`s
- KPIs e ranking recalculados com base nos membros filtrados

#### Modo foco (MemberDetailModal)
- Estado `projetoFilter: string | null` (null = todos)
- Select ao lado dos tabs de status existentes
- Filtra `tarefas` e `filteredTarefas` pelo `projeto_id` selecionado
- Gráfico de evolução mensal também recalcula com base nas tarefas filtradas
- Barra de progresso na tarefa (pendente do plano anterior) será incluída junto

#### Componente do filtro
- Reutilizar `Select`/`SelectContent`/`SelectItem` do shadcn já existente
- Opção "Todos os projetos" como valor padrão

