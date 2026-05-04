# E2E Aprovações — matriz de papéis e relatório consolidado

## Objetivo

Garantir cobertura de **permissões** executando o mesmo fluxo de Aprovações com
dois papéis distintos a cada PR/push, e produzir um **relatório consolidado por
papel** com links diretos para screenshots, vídeos e traces das falhas.

## Matriz

`.github/workflows/e2e-aprovacoes.yml` define `strategy.matrix.include`:

| Papel | Login | Cobertura esperada |
|---|---|---|
| `vendedor` | `E2E_VENDEDOR_EMAIL` / `E2E_VENDEDOR_PASSWORD` | Só vê os próprios itens; não acessa cards de outros vendedores. |
| `supervisor` | `E2E_SUPERVISOR_EMAIL` / `E2E_SUPERVISOR_PASSWORD` | Vê todos os itens da equipe (RLS via `supervisor_id`). |

`fail-fast: false` — uma falha em um papel não cancela o outro. Cada papel sobe
seus próprios artefatos (`playwright-report-<role>-<run_id>` e
`playwright-test-results-<role>-<run_id>`).

A variável `E2E_ROLE` é exportada para os specs (use em `test.skip(...)` se
algum teste só fizer sentido para um papel).

## Reset isolado vs. seed

São **dois scripts** com responsabilidades separadas:

| Script | Faz | Não faz |
|---|---|---|
| `scripts/seed/e2e-aprovacoes-reset.ts` | Apaga **apenas** comentários `Teste e2e CI%` e eventos extras da instância fixa do E2E. | Não toca em outras tabelas, não toca em dados fora dos UUIDs fixos, não cria nada. |
| `scripts/seed/e2e-aprovacoes.ts` | Re-aponta ownership dos fixtures para o usuário do papel atual e garante role/supervisor. | Não cria fixtures (isso é da migration `*_seed_e2e_aprovacoes.sql`). |

Ordem de execução em CI (por job da matriz):

1. **Reset** — banco volta ao estado seed (apenas escopo E2E).
2. **Seed** — ownership migra para o usuário do papel atual.
3. **Playwright** — roda specs com `E2E_ROLE=<role>`.

Esse split garante:

- Reset 100% idempotente e isolado (não risca dados de outros testes/usuários).
- Cada papel da matriz começa do mesmo estado base.
- Não há corrida entre `vendedor` e `supervisor` (concurrency group cancela
  execuções concorrentes do mesmo branch).

## Secrets adicionais necessários

Em **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Descrição |
|---|---|
| `E2E_VENDEDOR_EMAIL` / `E2E_VENDEDOR_PASSWORD` | Conta com role básica e supervisor configurado. |
| `E2E_SUPERVISOR_EMAIL` / `E2E_SUPERVISOR_PASSWORD` | Conta supervisora da conta vendedora. |
| `E2E_SUPABASE_URL`, `E2E_SUPABASE_SERVICE_ROLE_KEY`, `E2E_BASE_URL` | Já existentes (ver `e2e-aprovacoes-seed.md`). |

`E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` deixam de ser usados pelo workflow —
podem ser removidos depois que a matriz estiver estável.

## Relatório consolidado

`scripts/ci/consolidate-playwright-report.ts` lê `playwright-report/results.json`
e gera `playwright-report/CONSOLIDATED.md` com:

- Resumo (passou / falhou / pulado / flaky).
- Link para o run e para o artefato com screenshots/vídeos/traces do papel.
- Por falha: spec, primeira linha do erro e **lista de anexos** (screenshots,
  vídeos, traces) com caminho relativo dentro do artefato.

O Markdown é:

1. Anexado ao **GitHub Step Summary** do job (visível na aba *Summary* do run).
2. Postado como **comentário do PR** (um comentário por papel, atualizado em
   re-runs via marcador HTML `<!-- e2e-aprovacoes:<role> -->`).

### Por que não link direto a cada arquivo?

Artefatos do GitHub Actions só expõem o **ZIP completo**. O relatório aponta o
caminho relativo dentro do ZIP — basta baixar o artefato uma vez e abrir os
arquivos listados (`bunx playwright show-trace <arquivo>` para traces).

## Rodar localmente

```bash
# Reset (apaga só dados do seed E2E)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  bun run scripts/seed/e2e-aprovacoes-reset.ts

# Seed para um papel específico
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
E2E_TEST_EMAIL=vendedor@example.com \
E2E_SUPERVISOR_EMAIL=supervisor@example.com \
  bun run scripts/seed/e2e-aprovacoes.ts

# Testes
E2E_BASE_URL=... E2E_TEST_EMAIL=vendedor@example.com E2E_TEST_PASSWORD=... \
E2E_ROLE=vendedor \
  bunx playwright test

# Relatório consolidado
bun run scripts/ci/consolidate-playwright-report.ts \
  --results playwright-report/results.json \
  --out playwright-report/CONSOLIDATED.md \
  --role vendedor
```

## Não regredir

- Não unir reset e seed em um único script — perde a garantia de "reset puro
  só apaga dados E2E".
- Não remover `fail-fast: false` da matriz — esconderia a falha do segundo papel.
- Manter sufixo `-${{ matrix.role }}-${{ github.run_id }}` nos artefatos para
  evitar colisão entre jobs da matriz.
