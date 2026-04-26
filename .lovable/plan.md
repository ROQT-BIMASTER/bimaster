## Objetivo

Garantir que cada gerente/coordenador veja **apenas a sua própria equipe** na tela "Minha Equipe — Projetos", enquanto **admins e o gerente geral** vejam **todas as equipes** do departamento de Projetos. Atualmente todo `gerente` cai na mesma lógica de subordinados, sem distinção entre "gerente de área" e "gerente geral", e não há um seletor para admins navegarem entre equipes.

## Diagnóstico atual

Arquivo: `src/hooks/useProjetosTeamData.ts`

- **Admin**: já carrega todos os profiles aprovados do depto Projetos (correto).
- **Gerente / Supervisor**: chama `get_subordinados(user_id)` recursivamente, que retorna **todos os descendentes** na hierarquia `supervisor_id`. Hoje isso já restringe corretamente o gerente à sua árvore — Luana (gerente) só vê quem está debaixo dela.
- **Falta**: um conceito de **"Gerente Geral"** (gerente que enxerga o departamento inteiro, equivalente ao admin para esta tela) e um **seletor de equipe** para admins inspecionarem a árvore de cada gerente.

## Plano

### 1. Definir "Gerente Geral" sem nova role
Critério: `role = 'gerente'` **e** `supervisor_id IS NULL` **e** pertence ao depto Projetos. Esses gerentes enxergam o departamento inteiro (mesma query do admin). Gerentes com `supervisor_id` definido continuam restritos aos próprios subordinados.

Implementação em `src/hooks/useProjetosTeamData.ts`:
- Buscar o profile do usuário logado (já temos `user.id`) para checar `supervisor_id` e `departamento_id`.
- Se `isAdmin` **ou** (`isGerente` **e** `supervisor_id IS NULL` **e** depto = Projetos) → carrega todos os profiles do depto (lógica atual de admin).
- Se `isGerente`/`isSupervisor` com `supervisor_id` definido → mantém `get_subordinados` (lógica atual).
- Incluir o **próprio usuário** no resultado quando for gerente (hoje só vêm os subordinados; o gerente não aparece como nó raiz da própria árvore).

### 2. Seletor de equipe para visualização gerencial
Em `src/pages/ProjetosMinhaEquipe.tsx`, adicionar um `Select` no topo (visível apenas quando o usuário é admin ou gerente geral) com opções:
- "Equipe completa (todas)" — comportamento atual.
- Uma entrada por gerente do depto (ex.: "Equipe da Luana") — filtra a árvore para a sub-hierarquia daquele gerente.

A filtragem é puramente client-side: pega o gerente escolhido em `members`, monta a sub-árvore e renderiza.

### 3. Cabeçalho contextual
Atualizar o subtítulo "Acompanhe a produtividade da equipe..." para refletir o escopo atual:
- Admin/Gerente geral sem filtro: "Visão completa — Departamento de Projetos".
- Filtro aplicado: "Equipe de {nome do gerente}".
- Gerente normal: "Sua equipe — {nome}".

### 4. KPIs do topo respeitam o escopo
Os 4 cards (Membros, Tarefas, Concluídas, Atrasadas) devem somar apenas os membros visíveis no escopo atual. Já é o comportamento — só confirmar que recalcula quando o filtro muda (`useMemo` sobre a lista filtrada).

### 5. Ranking de Produtividade respeita o escopo
O painel lateral de ranking deve refletir o mesmo recorte da hierarquia (apenas os membros visíveis). Como usa a mesma lista, passa a refletir o filtro automaticamente.

### 6. Defesa no banco (consulta segura)
Não há mudança de RLS necessária — `profiles` e `projeto_tarefas` já têm políticas adequadas. A regra de "gerente geral" é apenas de **apresentação**, mas é importante que a query no hook não exponha dados a um gerente comum: a checagem é feita antes de decidir qual caminho seguir, e o caminho de "depto inteiro" só é tomado se `supervisor_id IS NULL` **no profile real do usuário** (lido do banco, não inferido do client).

## Arquivos a editar

- `src/hooks/useProjetosTeamData.ts` — ler `supervisor_id` do usuário, decidir entre "depto inteiro" vs "subordinados", incluir o próprio gerente no resultado.
- `src/pages/ProjetosMinhaEquipe.tsx` — adicionar seletor de equipe (apenas admin/gerente geral), aplicar filtro na hierarquia, atualizar subtítulo contextual.

## Não-objetivos

- Não criar nova role no banco (`gerente_geral`). O conceito é derivado de `role + supervisor_id`.
- Não alterar RLS nem `get_subordinados`.
- Não tocar no avatar upload, modal de detalhe ou ranking — apenas a fonte de dados muda.