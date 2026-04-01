

# Adicionar Botão "Nova Tarefa" na página Minhas Tarefas

## Problema
A página "Minhas Tarefas" não possui opção para criar novas tarefas diretamente.

## Solução
Adicionar um botão "Nova Tarefa" no header da página que abre o `NovaAtividadeDialog` (já existente no sistema) ou um dialog simplificado para criar tarefa rápida com campos mínimos (título, projeto, prazo, prioridade).

## Alterações

### 1. `src/pages/MinhasTarefas.tsx`
- Importar `Button` e `Plus` icon
- Adicionar botão `+ Nova Tarefa` ao lado direito do header (entre as stats e o view switcher)
- Integrar um dialog de criação rápida de tarefa com:
  - **Título** (obrigatório)
  - **Projeto** (select com projetos do usuário)
  - **Prazo** (date picker opcional)
  - **Prioridade** (select opcional)
- Ao criar, inserir em `projeto_tarefas` com `responsavel_id = user.id` e invalidar a query `minhas-tarefas`

### 2. Componente inline (dentro do mesmo arquivo ou novo `NovaTarefaDialog.tsx`)
- Dialog com form simples usando os componentes UI existentes
- Query para listar projetos do usuário (para o select de projeto)
- Mutation de insert na tabela `projeto_tarefas`

## Resultado
Botão visível no header → Dialog abre → Usuário preenche título + projeto → Tarefa criada e aparece na lista imediatamente.

