# Bi Master — Sistema Integrado ERP/CRM/PLM

[![lint-and-build](https://github.com/ROQT-BIMASTER/Roqt-Bimaster/actions/workflows/lint-and-build.yml/badge.svg?branch=main)](https://github.com/ROQT-BIMASTER/Roqt-Bimaster/actions/workflows/lint-and-build.yml)
[![typecheck](https://github.com/ROQT-BIMASTER/Roqt-Bimaster/actions/workflows/typecheck.yml/badge.svg?branch=main)](https://github.com/ROQT-BIMASTER/Roqt-Bimaster/actions/workflows/typecheck.yml)
[![tests](https://github.com/ROQT-BIMASTER/Roqt-Bimaster/actions/workflows/tests.yml/badge.svg?branch=main)](https://github.com/ROQT-BIMASTER/Roqt-Bimaster/actions/workflows/tests.yml)
[![security-rls-e2e](https://github.com/ROQT-BIMASTER/Roqt-Bimaster/actions/workflows/security-rls-e2e.yml/badge.svg?branch=main)](https://github.com/ROQT-BIMASTER/Roqt-Bimaster/actions/workflows/security-rls-e2e.yml)
[![CodeQL](https://github.com/ROQT-BIMASTER/Roqt-Bimaster/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/ROQT-BIMASTER/Roqt-Bimaster/actions/workflows/codeql.yml)


Sistema interno Bi Master de gestão integrada cobrindo Financeiro (DRE IFRS-18,
AP/AR, fluxo de caixa), Trade Marketing, Marketing/Influenciadores, Fábrica/PLM
(BOM, custos, MRP, fiscal), Projetos, Operações China–Brasil, Vendas, Portal
Cliente e Administração. White-label "Huggs" para clientes.

## Stack

- **Frontend**: Vite 5 + React 18 + TypeScript 5 + Tailwind 3 + shadcn/ui (Radix)
- **Estado/forms**: TanStack Query 5, React Hook Form 7, Zod 3 (`.strict()`)
- **Backend**: Supabase (Postgres + Auth + Storage) com 220+ Edge Functions Deno e RLS multi-tenant
- **Edge HTTP**: Cloudflare Workers (security headers, CSP, HSTS, X-Frame-Options)
- **IA**: gateway de inferência proxy (OpenAI / Anthropic / Google) — ver `docs/INFRASTRUCTURE.md`
- **Pacotes**: Bun (`bun.lockb`)

## Quickstart

```bash
bun install
cp .env.example .env   # preencha as chaves publishable do backend de dev
bun run dev            # http://localhost:8080
```

As chaves de service-role nunca ficam no front — apenas em Edge Functions
(`Deno.env.get`). Detalhes em
[`docs/onboarding/01-STACK-AND-SETUP.md`](./docs/onboarding/01-STACK-AND-SETUP.md).

## Comandos

| Comando | Descrição |
|---|---|
| `bun run dev` | Vite dev server |
| `bun run build` | Build de produção |
| `bun run build:dev` | Build com sourcemaps |
| `bun run typecheck` | `tsc --noEmit` (espelha `typecheck.yml`) |
| `bun run lint` | ESLint (espelha job `lint` de `lint-and-build.yml`) |
| `bun run test` | Vitest em modo run (espelha `tests.yml`) |
| `bun run verify` | typecheck + lint + test em sequência — rode antes de abrir PR |
| `bash scripts/security/e2e-anonymous-sensitive-columns.sh` | Smoke E2E de RLS anônima |

## Verificação local

Antes de abrir um PR, rode a mesma bateria que o CI executa em cada push e pull
request:

```bash
bun install
bun run verify        # typecheck + lint + testes unitários
```

`verify` falha rápido na primeira etapa quebrada. Mapeamento direto com o CI:

| Comando local | Workflow no GitHub Actions |
|---|---|
| `bun run typecheck` | `.github/workflows/typecheck.yml` |
| `bun run lint` | `.github/workflows/lint-and-build.yml` (job `lint`) |
| `bun run test` | `.github/workflows/tests.yml` |
| `bun run build` | `.github/workflows/lint-and-build.yml` (job `build`) |

Se `verify` passar local e o build manual também, o pipeline no GitHub Actions
deve passar — qualquer divergência indica deriva de versão de Node/Bun ou cache
local sujo (`rm -rf node_modules dist .vite && bun install`).

## Estrutura

```text
src/
  pages/            # rotas top-level agrupadas por módulo
  components/       # UI por domínio (financeiro, trade, fabrica, projetos, ...)
  hooks/            # React Query hooks + lógica de negócio
  contexts/         # AuthContext, EmpresaContext, etc.
  lib/              # utils, formatters, validations Zod, presentation builders
  integrations/     # cliente Supabase (auto-gerado)
supabase/
  functions/        # 220+ Edge Functions Deno
  migrations/       # 1100+ migrations SQL versionadas
docs/               # documentação técnica e de onboarding
public/             # assets estáticos, _headers, robots, service worker
cloudflare/         # Worker e wrangler.toml para edge security headers
scripts/            # manutenção, segurança E2E, drills DR
```

## Documentação

Comece por [`docs/onboarding/00-INDEX.md`](./docs/onboarding/00-INDEX.md).

| Tópico | Documento |
|---|---|
| Arquitetura geral | [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) |
| Diagramas | [`docs/ARCHITECTURE_DIAGRAMS.md`](./docs/ARCHITECTURE_DIAGRAMS.md) |
| Módulos de negócio | [`docs/MODULES_OVERVIEW.md`](./docs/MODULES_OVERVIEW.md) |
| Edge Functions | [`docs/EDGE_FUNCTIONS.md`](./docs/EDGE_FUNCTIONS.md) |
| APIs REST (ERP) | `docs/API_*.md` |
| Segurança | [`docs/security/README.md`](./docs/security/README.md) |
| Infraestrutura | [`docs/INFRASTRUCTURE.md`](./docs/INFRASTRUCTURE.md) |
| Deploy | [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) |
| Performance | [`docs/PERFORMANCE.md`](./docs/PERFORMANCE.md) |
| Testes | [`docs/TESTING.md`](./docs/TESTING.md) |
| Histórico de Item de Aprovação (hooks) | [`src/hooks/itemHistorico/README.md`](./src/hooks/itemHistorico/README.md) |

### Hooks de domínio

- **Histórico de Item de Aprovação** — barrel oficial `@/hooks/itemHistorico` expõe
  `useItemHistorico` (timeline paginada com filtros por ação/data e ordenação),
  `useComentarItem` (mutation que invalida o cache) e os tipos `HistoricoEntry` /
  `HistoricoFilters`. Nunca importe direto de `@/hooks/useItemHistorico` — a regra
  ESLint `no-restricted-imports` bloqueia. Exemplos de uso em
  [`src/hooks/itemHistorico/README.md`](./src/hooks/itemHistorico/README.md).
## Contribuição

Ver [`CONTRIBUTING.md`](./CONTRIBUTING.md). Regras para code agents (Cursor,
Copilot, Claude Code, etc.) em [`AGENTS.md`](./AGENTS.md).

## Segurança

Política de disclosure em [`SECURITY.md`](./SECURITY.md).

## Licença

Proprietário — Bi Master. Todos os direitos reservados. Ver [`LICENSE`](./LICENSE).
