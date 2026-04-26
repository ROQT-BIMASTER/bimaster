## Objetivo
Permitir que o número do processo (`product_process.numero_processo`) seja **comunicado** na tela de detalhes da tarefa, com opção de **configuração** (vincular/trocar) e **pesquisa** restrita ao perfil **Gerente** (e Admin/Supervisor).

## Diagnóstico atual
- Cada tarefa pode ter `produto_id` (já existente).
- O processo está em `product_process` (campos: `produto_tipo`, `produto_ref_id`, `numero_processo`, `etapa_atual`).
- Hoje a tarefa não exibe o número do processo, mesmo quando há produto vinculado.
- O hook `useProductProcess` já fornece a estrutura para buscar/criar processos.
- O hook `useUserRole` expõe `isGerente`, `isAdmin`, `isSupervisor`.

## Mudanças propostas

### 1. Novo hook `useTarefaProcesso.ts` (`src/hooks/`)
- Recebe `produto_id` da tarefa.
- Resolve o `product_process` correspondente (tentando `produto_tipo` em ordem: `brasil` → `china` → `fabrica` via `produto_ref_id = produto_id`).
- Retorna: `processo` (com `numero_processo`, `etapa_atual`), `isLoading`, função `vincularProcesso(processoId)` e `criarProcesso()`.

### 2. Novo componente `TarefaProcessoSection.tsx` (`src/components/projetos/tarefa-detalhe/`)
Exibido na coluna direita da `ProjetoTarefaDetalhe`, logo abaixo do bloco "Produto":
- **Visualização (todos os usuários)**: badge com ícone `Hash`/`FileBadge` mostrando `Nº Processo: PROC-XXXX` + etapa atual em badge secundário. Clique copia o número.
- **Sem processo vinculado**: mensagem "Nenhum processo vinculado".
- **Ações de configuração (apenas Gerente/Admin/Supervisor)**:
  - Botão **"Vincular processo"** abre `Popover` com `Command` (busca por `numero_processo` ou produto associado) consultando `product_process` em tempo real (debounce 300ms, limit 20).
  - Botão **"Criar processo"** quando produto existe mas processo ainda não — chama `createProcess` do `useProductProcess`.
  - Botão **"Desvincular"** (ícone X) apenas para Gerente/Admin.
- Cada vinculação/desvinculação registra atividade em `projeto_tarefa_atividades` (tipo `processo_vinculado` / `processo_desvinculado`) usando o helper já existente `registrarMovimentacaoNaTarefa` adaptado, ou um novo `logAtividade` inline.

### 3. Persistência do vínculo
Como a tarefa já se conecta ao processo via `produto_id → product_process.produto_ref_id`, **não é necessária nova coluna**. A "vinculação" do processo na tarefa = atualizar `produto_id` da tarefa para o `produto_ref_id` do processo escolhido. Isso mantém a fonte única de verdade e evita divergências.

### 4. Integração com `ProjetoTarefaDetalhe.tsx`
- Importar `TarefaProcessoSection` e renderizá-lo logo após o bloco de Produto (linha ~608).
- Passar `tarefaId`, `produtoId`, `projetoId` e `onUpdate` como props.

### 5. Timeline
Atualizar `ProjetoTarefaTimeline.tsx` para exibir os novos tipos de atividade `processo_vinculado` / `processo_desvinculado` com ícone `FileBadge` e label "Processo vinculado/desvinculado".

## Segurança
- Permissões aplicadas no frontend via `useUserRole` (`isGerente || isAdmin || isSupervisor`).
- RLS de `product_process` já protege backend; busca usa `select` autenticado padrão.

## Fora do escopo
- Não criar nova tabela ou coluna.
- Não alterar a estrutura de `product_process`.
- Não alterar regras de RLS existentes.

## Arquivos
- **Novos**: `src/hooks/useTarefaProcesso.ts`, `src/components/projetos/tarefa-detalhe/TarefaProcessoSection.tsx`
- **Editados**: `src/components/projetos/ProjetoTarefaDetalhe.tsx`, `src/components/projetos/ProjetoTarefaTimeline.tsx`
