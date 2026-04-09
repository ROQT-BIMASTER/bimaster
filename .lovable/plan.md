

# Incluir Tarefas de Colaboradores em "Minhas Tarefas"

## Problema

O hook `useMinhasTarefas` busca apenas tarefas onde `responsavel_id = user.id`. Os usuários do Time Criação estão marcados como **colaboradores** (`projeto_tarefa_colaboradores`) em diversas tarefas importadas do Asana, mas essas tarefas nao aparecem na tela "Minhas Tarefas".

| Usuario | Responsavel | Colaborador |
|---------|-------------|-------------|
| Gabriela Rocha | 49 | 66 |
| Nathalia Piovani | 36 | 59 |
| Giulia Honda | 0 | 26 |
| Natasha Lima | 0 | 33 |

## Plano

### 1. Alterar `src/hooks/useMinhasTarefas.ts`

Expandir a query para buscar tarefas em duas fontes e unificar:
- **Query 1**: Tarefas onde `responsavel_id = user.id` (atual)
- **Query 2**: Tarefas onde o user aparece em `projeto_tarefa_colaboradores`

Unificar os resultados removendo duplicatas (uma tarefa pode ter o user como responsavel E colaborador). Adicionar um campo `papel` ("responsavel" ou "colaborador") para diferenciar na UI se desejado.

A logica de filtro por secoes permitidas permanece inalterada.

### 2. Nenhuma alteracao de banco de dados

A tabela `projeto_tarefa_colaboradores` ja existe e possui 184 registros para esses 4 usuarios. Nao e necessaria nenhuma migracao.

## Resultado

Os 4 usuarios do Time Criacao verao todas as tarefas do Asana nas quais estao marcados (como colaboradores), alem das tarefas onde sao responsaveis diretos.

| Componente | Tipo |
|-----------|------|
| `src/hooks/useMinhasTarefas.ts` | Edicao |

