## Contexto

Na **Central de Trabalho** (`/dashboard/projetos/central`), o cabeçalho (`CentralHeader.tsx`, linhas 500-502) tem apenas um botão único **"Nova Tarefa"**. Não há acesso à criação de **novo projeto** a partir dessa tela — o usuário precisa navegar até `/dashboard/projetos` e clicar em "Novo Projeto" lá. O componente `NovoProjetoDialog` já existe em `src/components/projetos/NovoProjetoDialog.tsx` e é usado em `src/pages/Projetos.tsx`.

## Solução proposta

Transformar o botão "Nova Tarefa" em um **dropdown "Criar"** com duas opções, mantendo a primária em destaque:

1. **Nova Tarefa** (mantém o `NovaTarefaMinhasDialog` atual)
2. **Novo Projeto** (abre o `NovoProjetoDialog` existente)

Padrão visual idêntico ao já usado em `ProjetoHomeQuickActions.tsx` (split com ícone `Plus` + `ChevronDown`, separador entre itens).

## Alterações

### `src/components/projetos/central/CentralHeader.tsx`
- Importar `DropdownMenu`/`DropdownMenuItem`/`DropdownMenuSeparator` (já parcialmente importados — apenas garantir os necessários), `ClipboardList`, `FolderPlus` e `NovoProjetoDialog`.
- Adicionar estado `showNewProject`.
- Substituir o botão isolado `Nova Tarefa` (linhas 500-502) por:
  - `DropdownMenuTrigger` com `Button` primário "Criar" + chevron.
  - `DropdownMenuItem` "Nova Tarefa" → `setShowNewTask(true)`.
  - `DropdownMenuSeparator`.
  - `DropdownMenuItem` "Novo Projeto" → `setShowNewProject(true)`.
- Renderizar `<NovoProjetoDialog open={showNewProject} onOpenChange={setShowNewProject} />` ao lado do `NovaTarefaMinhasDialog` existente.

## Considerações

- **Permissão**: `NovoProjetoDialog` já valida internamente quem pode criar projetos (consistente com `useProjetos`). Sem mudança de governança necessária.
- **Não modifica** lógica de tarefas, filtros ou preferências existentes.
- **Sem migração** de banco nem alteração em edge functions.
- Mantém o atalho rápido de "Nova Tarefa" como primeira opção do dropdown (operação mais frequente).