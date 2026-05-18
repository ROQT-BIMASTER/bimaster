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

## Migrations destrutivas

Marque se este PR contém **alguma** migration com `DELETE`, `TRUNCATE`,
`DROP TABLE`, `DROP SCHEMA` ou `ALTER ... DROP COLUMN` em tabelas de dados de
domínio (`fabrica_*`, `china_*`, `projeto_*`, `trade_*`, `financeiro_*`,
`contas_*`, `marketing_*`, `inbox_*`, `vendas_*`, `compras_*`, `estoque_*`,
`composicao_*`, `ficha_*`, `ordens_*`, `produtos_*`, `tarefas_*`,
`aprovacoes_*`):

- [ ] N/A — este PR não contém migration destrutiva
- [ ] Token `-- ALLOW-DESTRUCTIVE: <motivo> (ticket BIM-####)` adicionado no topo da migration
- [ ] Escopo limitado por tabela (sem prefixos amplos sem necessidade)
- [ ] Backup/PITR confirmado antes do merge
- [ ] CI `guard-destructive-migrations` passou
- [ ] Revisor humano além do autor da migration aprovou

Ref.: `docs/incidents/2026-05-16-fabrica-br-data-loss.md`

## Notas para o revisor

<!-- Pontos de atenção, riscos, rollback. -->
