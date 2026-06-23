# Auditoria 2026-Q2 — ROQT-BIMASTER

Diretório-mãe do ciclo de auditoria executado em junho/2026. A entrega é
escalonada em 5 PRs sequenciais; cada PR adiciona ou refresca artefatos aqui
e nos diretórios linkados.

| PR | Branch | Escopo | Status |
| -- | ------ | ------ | ------ |
| PR-1 | `chore/audit-governance-and-ci` | Governança (CODEOWNERS, CoC, templates, labels) e CI hardening (CodeQL, dependency-review, PR size) | ✅ Entregue |
| PR-2 | `docs/audit-architecture-and-modules` | `CODE_HEALTH.md`, `ARCHITECTURE_REVIEW.md`, `MODULES_REVIEW.md` | ✅ Entregue |
| PR-3 | `docs/audit-routes-edge-db` | Inventários de rotas, edge functions e schema; refresh de `INFRASTRUCTURE.md`, `DEPLOYMENT.md`, `SECURITY.md`, `PERFORMANCE.md`, `TESTING.md` | Próximo |
| PR-4 | `chore/audit-doc-automation` | Scripts geradores em `scripts/audit/` + workflow `docs-drift.yml` | Pendente |
| PR-5 | `docs/audit-executive-report` | Sumário executivo, roadmap priorizado, ficha por módulo | Pendente |

## Artefatos deste diretório

- [`GITHUB_BRANCH_PROTECTION.md`](./GITHUB_BRANCH_PROTECTION.md) — regras de proteção da `main` (PR-1).
- [`CODE_HEALTH.md`](./CODE_HEALTH.md) — saúde do código TS (god-files, `any`, strict, métricas) (PR-2).
- [`ARCHITECTURE_REVIEW.md`](./ARCHITECTURE_REVIEW.md) — divergências entre docs arquiteturais e estado atual (PR-2).
- [`MODULES_REVIEW.md`](./MODULES_REVIEW.md) — snapshot por módulo e observações da auditoria do módulo Projetos (PR-2).
- `00-SUMARIO_EXECUTIVO.md` em diante — relatório executivo (PR-5).

## Princípios

- Tudo é descritivo: nenhum PR desta auditoria refactora código de produto.
- Módulo Projetos: audita e documenta, **não edita** código.
- Cada PR é independentemente mergeável e tem checklist de validação próprio.
- Documentação é regenerável a partir do código (objetivo de PR-4).

## Metodologia

A metodologia completa (escopo, ferramentas, limitações, datas) entra em
`99-METODOLOGIA.md` junto com o relatório executivo (PR-5).
