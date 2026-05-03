# Pull Request

## Resumo

<!-- O que muda e por quê. 1-3 linhas. -->

## Tipo

- [ ] feat
- [ ] fix
- [ ] chore / refactor
- [ ] docs
- [ ] security

## Áreas afetadas

<!-- financeiro, trade, fábrica, projetos, marketing, china, admin, infra, etc. -->

## Checklist

- [ ] `bun run lint` passa
- [ ] `bunx vitest run` passa
- [ ] Build limpo
- [ ] Mudança em SDK/OpenAPI/`APP_VERSION` registrada em `src/pages/admin/ApiDocumentation.tsx`
- [ ] Mudança em RLS validada via `scripts/security/e2e-*.sh`
- [ ] Documentação atualizada (`docs/`, `AGENTS.md`) quando aplicável
- [ ] Sem cores literais; sem `new Date(string)` em colunas DATE; Zod `.strict()`

## Notas para o revisor

<!-- Pontos de atenção, riscos, rollback. -->
