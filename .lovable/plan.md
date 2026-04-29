## Objetivo

Estruturar a equipe de **Compras** com Rubens Silva como coordenador das três analistas (Isabella Moraes, Ingrid Lima, Saynara Freitas) e fazer com que apareçam na tela `/dashboard/projetos/minha-equipe`, identificadas como **Compras**.

## Situação atual

| Pessoa | Supervisor atual | Departamento | Role |
|---|---|---|---|
| Rubens Silva | (nenhum) | (nenhum) | vendedor |
| Isabella Moraes | Luana Bazilio | (nenhum) | vendedor |
| Ingrid Lima | Luana Bazilio | (nenhum) | vendedor |
| Saynara Freitas | Luana Bazilio | (nenhum) | vendedor |

Departamentos relevantes:
- **Projetos** — `9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130`
- **Compras e Faturamento** — `c2bafe92-2e57-4146-86bb-aca33d8fc02e`

A tela `ProjetosMinhaEquipe` hoje filtra em `useProjetosTeamData.ts` **apenas** pelo `departamento_id = Projetos`. Por isso, mesmo arrumando a hierarquia, os 4 não vão aparecer sem ajuste no hook.

## Mudanças propostas

### 1. Hierarquia (atualização de dados — `supabase--insert`)

- `profiles`:
  - Rubens → `departamento_id = Compras e Faturamento`, `supervisor_id = NULL`.
  - Isabella, Ingrid, Saynara → `departamento_id = Compras e Faturamento`, `supervisor_id = Rubens`.
- `user_roles`:
  - Rubens: `vendedor` → `supervisor` (necessário para enxergar a equipe e aparecer como nó-raiz na hierarquia; o enum `app_role` não tem `coordenador`).
  - Isabella, Ingrid, Saynara: permanecem `vendedor`.

### 2. Inclusão de Compras na tela "Minha Equipe" de Projetos (frontend)

Em `src/hooks/useProjetosTeamData.ts`:
- Adicionar `DEPT_COMPRAS_ID` e expandir o filtro para `departamento_id IN (Projetos, Compras)`.
- A lógica de "Gerente Geral" (sem supervisor + dept Projetos) continua igual; adicionar regra equivalente para Compras (Rubens, sem supervisor + dept Compras → enxerga todos do dept Compras).
- Para usuários comuns, a hierarquia via `get_subordinados` já funciona naturalmente (Rubens verá as 3 analistas).

Em `src/pages/ProjetosMinhaEquipe.tsx`:
- Adicionar mapa `DEPARTAMENTO_BADGE` (Projetos / Compras) e exibir um badge ao lado de cada membro (cor distinta para Compras).
- Para Rubens: badge derivado **"Coordenador de Compras"** (regra: `departamento = Compras` + `supervisor_id = NULL`).
- Para as analistas: badge **"Analista de Compras"**.
- Ajustar título/subtítulo da página para refletir que abrange Projetos e Compras (ex.: "Minha Equipe — Projetos & Compras").

### 3. Sem mudanças de schema, RLS ou enums

Nenhuma migration. Apenas update de dados + ajuste de filtro/UI no frontend.

## Pontos a confirmar

1. **OK promover Rubens para `supervisor`** no role (sem isso ele não enxerga a equipe nem aparece como nó da árvore)?
2. **OK mover as 3 analistas** de Luana Bazilio para Rubens como supervisor?
3. **OK incluir o departamento Compras na tela "Minha Equipe" de Projetos** (a tela passa a mostrar Projetos + Compras), em vez de criar uma tela separada?
