

# Vincular colaboradores do Asana à equipe da Luana

## Situação atual

18 colaboradores importados do Asana estão ativos nos projetos, mas **nenhum** tem `supervisor_id` definido (exceto Ahmad, que aponta para outro usuário). Ou seja, não aparecem na hierarquia da Luana.

## Plano

### 1. Atualizar `supervisor_id` dos 18 colaboradores

Criar uma migration que defina `supervisor_id = '2f3df7bd-7db9-404a-8093-d80168ceab70'` (Luana) para todos os 18 perfis importados do Asana.

Isso fará com que:
- Apareçam como subordinados da Luana no módulo de equipe
- Sejam visíveis para supervisores/admins na hierarquia
- O hook `useProjetosTeamData` os inclua automaticamente via `get_subordinados`

### 2. Arquivo alterado

| Arquivo | Alteração |
|---|---|
| Migration SQL | `UPDATE profiles SET supervisor_id = '...' WHERE id IN (...)` para os 18 IDs |

