

# Filtros e Ações Avançadas na Home de Projetos

## Objetivo

Adicionar à tela Home (`ProjetoHome.tsx`) uma barra de filtros para tarefas e um botão de criação rápida com opções completas (nova tarefa, vincular a projeto, criar seção).

## O que será feito

### 1. Barra de Filtros na seção "Minhas Tarefas"

Adicionar entre o título "Minhas Tarefas" e a lista de tarefas uma barra com:

- **Busca por texto** — Input de busca que filtra tarefas por título (client-side, já temos os dados carregados)
- **Filtro por Projeto** — Select com lista dos projetos do usuário (extraída das tarefas já carregadas), filtra por `projeto_id`
- **Filtro por Seção** — Select dinâmico (carrega seções do projeto selecionado via query), filtra por `secao_id` (precisa incluir `secao_id` na interface `MinaTarefa` — já é carregado no hook mas não exposto na interface)

Todos os filtros funcionam client-side sobre os dados já carregados.

### 2. Botão "Nova Tarefa" com opções expandidas

Substituir o botão simples de Quick Actions por um **DropdownMenu** com as seguintes opções:

- **Nova Tarefa** — Abre o `NovaTarefaMinhasDialog` já existente (seleciona projeto, prioridade, prazo)
- **Nova Seção em Projeto** — Abre um dialog simples: seleciona projeto → nome da seção → cria via insert em `projeto_secoes`
- **Nova Tarefa em Seção** — Abre dialog: seleciona projeto → seleciona seção → nome da tarefa → cria

### 3. Ajuste no hook `useMinhasTarefas`

Expor `secao_id` e `secao_nome` na interface `MinaTarefa` (secao_id já está sendo carregado internamente mas precisa ser adicionado à interface exportada; secao_nome precisa de um join adicional).

## Detalhes Técnicos

### Barra de filtros (novo componente)

Criar `src/components/projetos/home/ProjetoHomeFilters.tsx`:
- Props: `tarefas`, `onFilterChange(filtered: MinaTarefa[])`
- Estado interno: `searchText`, `selectedProjetoId`, `selectedSecaoId`
- Extrair lista de projetos únicos das tarefas
- Quando projeto selecionado, buscar seções via query
- Aplicar filtros e retornar resultado ao pai

### Dialog de Nova Seção

Criar `src/components/projetos/home/NovaSecaoDialog.tsx`:
- Seleciona projeto → input do nome → insert em `projeto_secoes` com `ordem` calculada

### Atualização da interface MinaTarefa

Adicionar `secao_id` e `secao_nome` ao tipo exportado — `secao_id` já existe no map interno, e `secao_nome` virá de um join com `projeto_secoes`.

## Arquivos

| Arquivo | Alteração |
|---|---|
| `src/components/projetos/home/ProjetoHomeFilters.tsx` | Novo — barra de filtros (busca, projeto, seção) |
| `src/components/projetos/home/NovaSecaoDialog.tsx` | Novo — dialog para criar seção em projeto |
| `src/components/projetos/home/ProjetoHomeQuickActions.tsx` | Expandir com DropdownMenu (Nova Tarefa, Nova Seção, Tarefa em Seção) |
| `src/hooks/useMinhasTarefas.ts` | Expor `secao_id` e `secao_nome` na interface |
| `src/pages/ProjetoHome.tsx` | Integrar filtros e estado filtrado na listagem de tarefas |

