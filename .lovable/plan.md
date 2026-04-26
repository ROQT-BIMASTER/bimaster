## Objetivo

Tornar **fácil e visual** a atribuição de **responsável** e **seguidores** diretamente na tela de tarefas do projeto, e garantir que **apenas membros cadastrados no projeto** possam ser adicionados (já é a fonte do `teamMembers`, mas falta blindar e exibir).

## Diagnóstico

- **Responsável**: já tem picker inline com avatar (`PersonPicker` em `ProjetoTarefaRow.tsx`). OK.
- **Seguidores**: só aparecem dentro do detalhe da tarefa (`TarefaResponsavelSeguidoresEditor`). **Não há coluna na lista** — o usuário precisa abrir cada tarefa para ver/adicionar seguidores.
- **Fonte de membros**: `useProjetoTarefas` (linha 442–462) já busca `teamMembers` somente de `projeto_membros` ✓. Mas o `ColaboradoresPicker` interno do `ProjetoTarefaRow` não está sendo renderizado em nenhuma coluna.

## Mudanças propostas

### 1. Nova coluna "Equipe" na lista de tarefas
- **`ColumnConfigPopover.tsx`**: adicionar coluna `{ key: "equipe", label: "Equipe", visible: true }` (com largura `minmax(120px, 140px)`).
- **`ProjetoListView.tsx`**: ajustar `GRID_COLS` e `buildGridCols` para incluir a nova coluna, posicionada logo após **Responsável**.
- **`ProjetoTarefaRow.tsx`**: 
  - Renderizar `ColaboradoresPicker` (já existe na linha 469) dentro da nova coluna `equipe`, com `vis("equipe")`.
  - Mostrar até 3 avatares empilhados (`-space-x-1`) + badge `+N` quando houver mais.
  - Botão `+` tracejado ao lado para abrir o popover de adicionar seguidor.
  - Conectar `onAdd={(userId) => onAddColaborador?.(tarefa.id, userId)}` e `onRemove` com os handlers já passados pelo `ProjetoListView`.

### 2. Restrição estrita a membros do projeto
- **`ColaboradoresPicker`** (em `ProjetoTarefaRow.tsx`): a lista do popover já recebe `members={teamMembers}` (que vem de `projeto_membros`). Adicionar:
  - **Estado vazio**: quando `teamMembers.length === 0`, exibir mensagem *"Adicione membros ao projeto na aba Equipe para atribuir seguidores"* + link para a aba Equipe.
  - **Filtro de busca** com input no topo do popover (mesmo padrão visual do `PersonPicker`).
- **`PersonPicker`** (responsável): já usa `teamMembers`. Adicionar o mesmo estado vazio para consistência.
- **Backend / RLS**: as tabelas `projeto_tarefas` (campo `responsavel_id`) e `projeto_tarefa_colaboradores` precisam de validação. Adicionar **trigger** `BEFORE INSERT/UPDATE` que rejeita o registro se o `user_id` (ou `responsavel_id`) **não estiver em `projeto_membros`** do mesmo projeto. Mensagem: *"Apenas membros do projeto podem ser atribuídos a tarefas"*.

### 3. Melhorias visuais (alinhadas ao tema do projeto)
- Avatares dos seguidores ganham **ring colorido com a `accentColor` do projeto** (vindo de `useProjetoCor`) para reforçar o branding já implementado.
- Tooltip ao passar o mouse no avatar mostra o **nome completo do membro** + papel (`coordenador`, `membro`).
- Botão `+` com `border-dashed` ganha hover com a cor do projeto.

### 4. Detalhe da tarefa (TarefaResponsavelSeguidoresEditor)
- Já está correto (usa `useProjetoMembros`). Apenas adicionar o mesmo **estado vazio** quando não há membros no projeto.

## Arquivos afetados

- `src/components/projetos/ColumnConfigPopover.tsx` — nova coluna `equipe`
- `src/components/projetos/ProjetoListView.tsx` — grid + render da coluna
- `src/components/projetos/ProjetoTarefaRow.tsx` — render do `ColaboradoresPicker` na coluna; estado vazio; filtro de busca; ring de cor do projeto
- `src/components/projetos/tarefa-detalhe/TarefaResponsavelSeguidoresEditor.tsx` — estado vazio quando sem membros
- **Nova migration**: trigger SQL `validate_tarefa_membro_projeto()` em `projeto_tarefas` e `projeto_tarefa_colaboradores`

## Resultado esperado

- Avatares dos seguidores **visíveis em cada linha** da lista, ao lado do responsável.
- Botão `+` em qualquer linha permite adicionar seguidor com **um clique**, escolhendo apenas entre membros do projeto.
- Tentativa de inserir não-membro (via API ou bypass) é **bloqueada no banco** pelo trigger.
- Aderência ao padrão visual do projeto (cor do projeto nos rings dos avatares).
