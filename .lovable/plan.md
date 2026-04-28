## Problema

Hoje, em **Minha Equipe — Projetos**, só **Admin / Gerente / Supervisor** conseguem clicar em qualquer membro para abrir o modal de performance (`canManage = isAdmin || isGerente || isSupervisor`). Vendedores, promotores e demais usuários veem a tela, mas o clique no próprio nome/avatar não faz nada — eles não conseguem visualizar nem o próprio perfil nem a própria colocação no ranking.

## Objetivo

Liberar para **qualquer usuário autenticado** o acesso ao **seu próprio cartão** (perfil + colocação no ranking + métricas pessoais), mantendo a regra atual para os demais membros: só coordenadores (admin/gerente/supervisor) podem abrir o perfil de outros.

## Comportamento esperado

- **Coordenador** (admin/gerente/supervisor): sem mudança — clica em qualquer membro da hierarquia ou do ranking e abre o modal de detalhe.
- **Usuário comum** (vendedor, promotor, etc.):
  - Pode clicar **no próprio card** na "Hierarquia da Equipe" e no "Ranking de Produtividade" → abre o mesmo modal de Foco com seus KPIs, gráfico semanal e lista de tarefas.
  - **Não** pode clicar em outros membros (linhas continuam não-clicáveis, sem cursor pointer).
  - **Não** pode trocar foto de outras pessoas — upload do avatar continua restrito ao próprio dono ou a coordenadores.

## Mudanças (somente frontend)

Arquivo único: `src/pages/ProjetosMinhaEquipe.tsx`.

1. Obter o `user.id` atual via `useAuth()` (já usado em outros pontos da página).
2. Substituir o booleano global `canManage` por uma função utilitária `canOpenMember(member)`:
   - Retorna `true` se `isAdmin || isGerente || isSupervisor` **ou** se `member.id === user.id`.
3. Atualizar `handleMemberClick(member)` para usar `canOpenMember(member)`.
4. Em `renderMember` (hierarquia) e no bloco de ranking:
   - Aplicar `cursor-pointer` / hover apenas quando `canOpenMember(member)` for verdadeiro.
   - Manter a UX atual para itens não clicáveis.
5. Em `AvatarWithUpload` dentro de `renderMember`, ranking e modal:
   - Trocar o prop `canUpload={canManage}` por `canUpload={isAdmin || isGerente || isSupervisor || member.id === user.id}` (cada um pode trocar a própria foto; coordenadores podem trocar de qualquer um).
6. Passar para `MemberDetailModal` o `canUpload` calculado dinamicamente para o membro selecionado, em vez do `canManage` global.

Nada na consulta de dados, RLS, hooks ou rotas precisa mudar — `useProjetosTeamData` já entrega o membro logado dentro da árvore.

## Critérios de aceitação

- Logada como Luana (gerente): comportamento atual preservado, abre qualquer membro.
- Logada como uma vendedora (ex.: Gabriela): consegue clicar **no próprio nome** na hierarquia e no ranking e ver o modal de Foco com seus dados; clicar em outra pessoa **não** faz nada.
- Upload de foto: cada usuário pode trocar a própria; coordenadores podem trocar a de qualquer membro; demais usuários não veem o overlay de câmera em fotos alheias.
- Nenhum impacto em outras telas.