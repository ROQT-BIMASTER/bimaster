

# Exibir Colaboradores de Tarefas na Lista de Projetos

## Problema

A coluna MEMBROS na lista de projetos mostra apenas os membros formais (`projeto_membros`), que são 1-2 por projeto. Porém, cada projeto tem 6-18 colaboradores reais importados do Asana (tabela `projeto_tarefa_colaboradores`), que não aparecem.

## Solução

### 1. Incluir colaboradores de tarefas no hook `useProjetos`

No `useProjetos.ts`, adicionar uma query que busca colaboradores únicos por projeto via `projeto_tarefa_colaboradores` + `projeto_tarefas` + `profiles`. Combinar com os membros formais, deduplicando por `user_id`.

### 2. Atualizar `membrosMap` em `Projetos.tsx`

Mesclar os dois conjuntos (membros formais + colaboradores de tarefas) no `membrosMap`, priorizando membros formais mas incluindo todos os colaboradores únicos com seus avatares.

### 3. Aumentar limite de avatares visíveis

Atualmente mostra no máximo 4 avatares + indicador "+N". Com mais colaboradores, pode ser útil aumentar para 6.

## Arquivos a alterar

| Arquivo | Alteração |
|---|---|
| `src/hooks/useProjetos.ts` | Adicionar query de colaboradores por projeto |
| `src/pages/Projetos.tsx` | Mesclar colaboradores no `membrosMap` |

## Resultado esperado

A coluna MEMBROS mostrará os avatares de todos os colaboradores (com fotos do Asana) de cada projeto, não apenas os membros formais.

