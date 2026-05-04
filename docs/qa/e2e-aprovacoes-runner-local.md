# E2E Aprovações — runner local, smoke tests e detecção de flakies

## Runner local da matriz

Comando único que reproduz o que o CI faz para os papéis `vendedor` e
`supervisor`, com **reset + seed automáticos por papel** e geração de
relatórios.

```bash
bun run e2e:matrix              # roda os dois papéis
bun run e2e:matrix vendedor     # só vendedor
bun run e2e:matrix supervisor   # só supervisor
```

Variáveis exigidas (export no shell ou em `.env.e2e.local`, gitignored):

```bash
# .env.e2e.local
E2E_BASE_URL=http://localhost:8080
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
E2E_VENDEDOR_EMAIL=vendedor@example.com
E2E_VENDEDOR_PASSWORD=...
E2E_SUPERVISOR_EMAIL=supervisor@example.com
E2E_SUPERVISOR_PASSWORD=...
```

Saída em `playwright-matrix-report/`:

```
playwright-matrix-report/
├── SUMMARY.md
├── vendedor/
│   ├── CONSOLIDATED.md
│   ├── FLAKY.md
│   ├── playwright-report/index.html
│   └── test-results/
└── supervisor/
    ├── CONSOLIDATED.md
    ├── FLAKY.md
    ├── playwright-report/index.html
    └── test-results/
```

Comandos auxiliares:

```bash
bun run e2e:reset    # reset isolado (só dados do seed E2E)
bun run e2e:seed     # seed/ownership para o usuário em E2E_TEST_EMAIL
bun run e2e:smoke    # só os smoke tests de permissão (rápido)
```

## Smoke tests de permissão

Arquivo: `e2e/aprovacoes/00-smoke-permissoes.spec.ts` (taggeado `@smoke`).

Por convenção de nome (`00-…`) roda primeiro na suíte; no CI a step
**"Smoke tests de permissão"** roda apenas `@smoke` antes do fluxo completo
(`--grep-invert @smoke`). Se o smoke falhar, o job já reprovou rápido sem
gastar tempo no fluxo principal.

Cobertura por papel (`E2E_ROLE`):

| Caso | `vendedor` | `supervisor` |
|---|---|---|
| Vê o item fixo do seed (`...000005`) | ✓ | ✓ |
| Vê controle "equipe / supervisão" | ausente | presente |

Smoke não substitui o spec de fluxo — apenas valida pré-requisitos de
permissão antes dele.

## Detecção de flaky

Script: `scripts/ci/detect-flaky-tests.ts`. Lógica:

1. Lê o `results.json` do run atual.
2. Persiste um snapshot enxuto (`{spec, status}`) em
   `playwright-history/<role>/<run_id>.json`.
3. Carrega os últimos N snapshots (default 30) e marca como flaky qualquer
   teste que tenha **ao menos 1 pass e 1 fail** nessa janela.
4. Gera `playwright-report/FLAKY.md` com a sequência observada
   (`✓ ✗ ✓ ✓ ✗`) por spec.

No CI o histórico é preservado entre runs via `actions/cache@v4`, com
chave `pw-history-<role>-<run_id>` e fallback `pw-history-<role>-`. Cada
papel tem seu próprio cache (vendedor ≠ supervisor).

Localmente, o histórico fica em `playwright-history/<role>/` (gitignored)
e acumula a cada `bun run e2e:matrix`.

> Flakies não quebram o build — o detector sempre sai com 0. O objetivo é
> visibilidade no Step Summary / artefatos. Antes de adicionar
> `test.retry()`, investigue o spec listado.

## Não regredir

- Não remover a step de smoke nem mudar a tag `@smoke` sem atualizar a
  step `--grep` / `--grep-invert` no workflow.
- Não apagar `playwright-history/<role>/` manualmente — perde a janela de
  detecção. Para reset completo, basta deletar o cache do GitHub Actions.
- Manter o `keep` do detector ≥ 10 — janela menor produz falsos positivos.
