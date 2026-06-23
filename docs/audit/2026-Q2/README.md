# Auditoria 2026-Q2 — ROQT-BIMASTER

Diretório-mãe do ciclo de auditoria executado em junho/2026. A entrega é
escalonada em 5 PRs sequenciais; cada PR adiciona ou refresca artefatos aqui
e nos diretórios linkados.

| PR | Branch | Escopo | Status |
| -- | ------ | ------ | ------ |
| PR-1 | `chore/audit-governance-and-ci` | Governança (CODEOWNERS, CoC, templates, labels) e CI hardening (CodeQL, dependency-review, PR size) | ✅ Entregue |
| PR-2 | `docs/audit-architecture-and-modules` | `CODE_HEALTH.md`, `ARCHITECTURE_REVIEW.md`, `MODULES_REVIEW.md` | ✅ Entregue |
| PR-3 | `docs/audit-routes-edge-db` | `ROUTES.md`, `EDGE_FUNCTIONS_REVIEW.md`, `DATABASE_REVIEW.md`, `SECURITY_REVIEW.md`, `INFRA_DEPLOY_TESTING_REVIEW.md` | ✅ Entregue |
| PR-4 | `chore/audit-doc-automation` | `scripts/audit/*` (5 geradores), `run-all.sh`, snapshots em `generated/`, workflow `docs-drift.yml` | ✅ Entregue |
| PR-5 | `docs/audit-executive-report` | Sumário executivo, roadmap priorizado, ficha por módulo | Próximo |
| PR-Nav-0 | `nav/pr-0-scaffold` | Scaffold inerte da navegação v2 (4 arquivos novos, 0 edições): `src/config/navigation/*`, `src/lib/featureFlags/navigationVersion.ts`, migration pendente em `migrations-pendentes/` | ✅ Entregue |

## Artefatos deste diretório

- [`GITHUB_BRANCH_PROTECTION.md`](./GITHUB_BRANCH_PROTECTION.md) — regras de proteção da `main` (PR-1).
- [`CODE_HEALTH.md`](./CODE_HEALTH.md) — saúde do código TS (PR-2).
- [`ARCHITECTURE_REVIEW.md`](./ARCHITECTURE_REVIEW.md) — divergências arquiteturais (PR-2).
- [`MODULES_REVIEW.md`](./MODULES_REVIEW.md) — snapshot por módulo (PR-2).
- [`ROUTES.md`](./ROUTES.md) — inventário de 357 rotas (PR-3).
- [`EDGE_FUNCTIONS_REVIEW.md`](./EDGE_FUNCTIONS_REVIEW.md) — 274 edge functions, helpers `_shared`, achados (PR-3).
- [`DATABASE_REVIEW.md`](./DATABASE_REVIEW.md) — 858 tabelas, 2.341 policies, 673 funções `SECURITY DEFINER`, 50 buckets (PR-3).
- [`SECURITY_REVIEW.md`](./SECURITY_REVIEW.md) — snapshot dos achados ativos dos scanners + patterns de remediação (PR-3).
- [`INFRA_DEPLOY_TESTING_REVIEW.md`](./INFRA_DEPLOY_TESTING_REVIEW.md) — deltas em `INFRASTRUCTURE/DEPLOYMENT/PERFORMANCE/TESTING.md` (PR-3).
- [`generated/`](./generated/) — snapshots determinísticos emitidos por `scripts/audit/*` e verificados por `.github/workflows/docs-drift.yml` (PR-4).
- [`NAV_V2_PLAN.md`](./NAV_V2_PLAN.md) — trilha "Navegação v2": plano, contrato visual, roadmap em 6 fases, rollback (PR-Nav-0).
- [`migrations-pendentes/`](./migrations-pendentes/) — migrations versionadas entregues para revisão e aplicadas em janela controlada pelo time.
- `00-SUMARIO_EXECUTIVO.md` em diante — relatório executivo (PR-5).

## Princípios

- Tudo é descritivo: nenhum PR desta auditoria refactora código de produto.
- Módulo Projetos: audita e documenta, **não edita** código.
- Cada PR é independentemente mergeável e tem checklist de validação próprio.
- Documentação é regenerável a partir do código (objetivo de PR-4).

## Metodologia

A metodologia completa (escopo, ferramentas, limitações, datas) entra em
`99-METODOLOGIA.md` junto com o relatório executivo (PR-5).
