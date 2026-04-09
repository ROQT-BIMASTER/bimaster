

# Liberar Acesso ao Módulo Projetos — Time de Criação

## Usuários

| Nome | Email | ID |
|------|-------|----|
| Gabriela Rocha | g.rocha@rubyrose.com.br | de96ca1b-a2ef-42c7-a467-f76f1227586e |
| Giulia Honda | g.honda@rubyrose.com.br | 59fed9c7-44df-4c44-9658-e6bccc4c501b |
| Nathalia Piovani | n.freitas@rubyrose.com.br | 7dffed05-0941-400f-bbdb-fcbf8454bea1 |
| Natasha Lima | n.lima@rubyrose.com.br | c2c10cb7-6913-49cd-a836-c16742d00db5 |

## Situação Atual

- Todos possuem apenas o módulo **Dashboard**
- Nenhum possui acesso ao módulo **Projetos**

## Visibilidade de Projetos

A visibilidade já é controlada pela função `user_can_access_projeto`, que concede acesso apenas a:
- Administradores
- Criador do projeto
- Membros do projeto (`projeto_membros`)
- Departamentos autorizados (`projeto_departamentos`)

Portanto, esses usuários **só verão projetos nos quais estejam como membros ou criadores**. Não é necessário criar lógica adicional — basta conceder as permissões de módulo e telas.

## Plano

### Insert SQL — Permissões de módulo e telas

Para cada um dos 4 usuários:
1. **Módulo Projetos** (`a6aa92be-30a6-4027-aa0d-225b96cc96fe`)
2. **7 telas**: Dashboard, Inbox, Aprovações, Vincular China, Produtos Brasil, Minha Equipe, Minhas Tarefas

Total: 4 × (1 módulo + 7 telas) = **32 inserts**

Nenhuma alteração de código necessária.

| Componente | Tipo |
|-----------|------|
| Insert SQL (módulo + telas) | Dados |

