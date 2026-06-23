# INFRA_DEPLOY_TESTING_REVIEW — Auditoria 2026-Q2

> Revisão pontual de `INFRASTRUCTURE.md`, `DEPLOYMENT.md`, `PERFORMANCE.md`,
> `TESTING.md`. Apenas deltas — os documentos canônicos permanecem válidos.

## 1. INFRASTRUCTURE.md (530 LoC) — deltas

| Item | Estado |
| --- | --- |
| Stack (Lovable + Lovable Cloud) | ✅ fiel |
| Cloudflare Worker em `cloudflare/worker.js` para `china.bimaster.online` | ❌ **não mencionado** — adicionar seção dedicada |
| PWA + heartbeat + `app_release_pins` | ❌ não mencionado — referenciar `mem://pwa/anti-cache-versioning` |
| Buckets de storage (50 privados) | ✅ inventário pode ser regenerado por script (PR-4) |
| Headers de segurança (HSTS/CSP/XFO) via Worker | ⚠️ documentar que Lovable hosting NÃO honra `public/_headers` (memória `mem://infra/cloudflare-worker-deploy`) |

## 2. DEPLOYMENT.md (313 LoC) — deltas

| Item | Estado |
| --- | --- |
| Sync bidirecional Lovable ↔ GitHub | ✅ fiel |
| Branch protection em `main` | ⚠️ entregue em PR-1 (`GITHUB_BRANCH_PROTECTION.md`) — referenciar daqui |
| Workflow `lint-and-build.yml` + `typecheck.yml` + `tests.yml` | ✅ ativo |
| Deploy do Worker via `wrangler` | ❌ não mencionado — passo manual obrigatório |
| Rollback de release (PWA kill switch + versão pinada) | ❌ não mencionado |

**Ação no PR-4:** adicionar subseção "Deploy do Cloudflare Worker" e
"Rollback emergencial" com referência aos scripts existentes.

## 3. PERFORMANCE.md — deltas

Existem 2 documentos paralelos relevantes (`DB-PERFORMANCE-AUDIT.md`,
`DB-PERFORMANCE-FASE-2A-RESULTADOS.md`).

| Item | Estado |
| --- | --- |
| Política RLS preferindo `EXISTS`/`IN` a funções (`mem://architecture/high-volume-rls-performance-standard`) | ✅ fiel |
| RAG `halfvec(3072)` + HNSW (`mem://ai/copilot-rag-pipeline-v2`) | ❌ não mencionado em `PERFORMANCE.md` |
| Cache TanStack Query (`staleTime: 5min`, `gcTime: 10min`) | ✅ fiel |
| Slow queries — não há referência ao tooling `supabase--slow_queries` | ⚠️ adicionar |

## 4. TESTING.md (288 LoC) — deltas

| Item | Estado |
| --- | --- |
| Stack (vitest + Testing Library + jsdom) | ✅ fiel |
| Cobertura atual: 54 arquivos de teste para 235 páginas raiz | ⚠️ não quantificado no doc |
| E2E RLS (`scripts/security/e2e-*.sh`) | ✅ documentado |
| Regression greps (`mem://process/release-changelog-discipline`) | ✅ documentado |
| **Sem** workflow de cobertura mínima (`vitest --coverage`) | ⚠️ candidato a PR-1.5 ou PR-4 |
| `e2e-aprovacoes.yml`, `e2e-china-docs.yml`, `e2e-datepicker-tz.yml` em `.github/workflows/` | ✅ presentes, devem ser listados no doc |

## 5. Resumo

Os 4 documentos não precisam ser **reescritos** — precisam de **inserções
pontuais**:

| Doc | Inserções pendentes |
| --- | --- |
| `INFRASTRUCTURE.md` | Worker Cloudflare, PWA kill switch, política de headers |
| `DEPLOYMENT.md` | Deploy do Worker via `wrangler`, rollback, link para `GITHUB_BRANCH_PROTECTION.md` |
| `PERFORMANCE.md` | RAG `halfvec(3072)` HNSW, `slow_queries` |
| `TESTING.md` | Quantificação de cobertura, lista atualizada de workflows E2E |

Estas inserções serão feitas em PR-4 (junto à automação) para evitar drift
manual: cada bloco será gerado a partir do filesystem.
