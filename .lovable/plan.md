

# Botão "Adicionar Equipe" no Dialog de Membros

## Problema
A gerente (Luana) precisa de uma forma rápida de adicionar membros da sua equipe ao projeto, sem precisar buscar um por um pelo nome.

## Plano

### Alterar `src/components/projetos/ProjetoMembrosDialog.tsx`

1. **Botão "Adicionar da Equipe"** — Exibir um botão ao lado do campo de busca (visível apenas para `isCoordinator`) que abre um sub-dialog listando os subordinados da gerente via `get_subordinados` RPC.

2. **Sub-dialog de seleção** — Reutilizar o padrão do `AddUserDialog` existente:
   - Listar subordinados do usuário logado (via `get_subordinados`)
   - Filtrar os que já são membros do projeto
   - Permitir seleção múltipla com checkboxes
   - Botão "Adicionar (N)" para inserir todos de uma vez

3. **Lógica de inserção** — Para cada usuário selecionado, chamar `addMembro.mutate` com papel "membro".

### Arquivos

| Componente | Alteração |
|-----------|-----------|
| `src/components/projetos/ProjetoMembrosDialog.tsx` | Adicionar botão + sub-dialog de equipe |

Nenhuma alteração de banco de dados necessária — a RPC `get_subordinados` já existe.

