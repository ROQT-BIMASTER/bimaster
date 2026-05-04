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

## Configuração: janela do detector e retries de smoke

Três variáveis controlam o comportamento, com a mesma precedência tanto no CI
quanto no runner local: **flag CLI > variável de ambiente > default**.

| Variável | Default | Onde configurar |
|---|---:|---|
| `FLAKY_KEEP` | `30` | CI: repo variable `E2E_FLAKY_KEEP` ou input do `workflow_dispatch` (`flaky_keep`). Local: `export FLAKY_KEEP=50`. |
| `SMOKE_RETRIES` | `2` (3 tentativas no total) | CI: repo variable `E2E_SMOKE_RETRIES` ou input `smoke_retries`. Local: `export SMOKE_RETRIES=3`. |

Exemplos:

```bash
# Local: janela maior + smoke menos tolerante
FLAKY_KEEP=50 SMOKE_RETRIES=1 bun run e2e:matrix

# CI ad-hoc: rodar pelo botão "Run workflow" e preencher os inputs.
```

## Retries só dos smoke tests

A suíte completa **não tem retry no nível do runner** (Playwright já tem
`retries: 2` em CI via `playwright.config.ts`). Os retries adicionais são
aplicados **somente** ao subset `@smoke`, executando um loop externo que
roda o Playwright filtrando por tag. Custo típico de cada tentativa de
smoke: poucos segundos, contra minutos da suíte completa.

Se o smoke falhar em todas as tentativas, o job marca erro **e pula a suíte
completa do papel** — não faz sentido seguir se a permissão básica está
quebrada. O comportamento é igual no CI e no `e2e:matrix` local.

## Artefatos de flaky disponíveis mesmo em falha precoce

Além de `playwright-report-<role>-<run_id>` (HTML report) e
`playwright-test-results-<role>-<run_id>` (screenshots/vídeos/traces),
o workflow sempre sobe um terceiro artefato dedicado:

- **`playwright-flaky-<role>-<run_id>`** (retenção 30 dias) contendo:
  - `playwright-report/FLAKY.md` — sempre gerado, mesmo se a suíte não rodar.
  - `playwright-history/<role>/*.json` — snapshots brutos para comparação
    manual (`diff`, `jq`, etc.) entre runs.

Como o detector cria `FLAKY.md` mesmo sem `results.json`, esse artefato
está disponível inclusive quando o smoke falha cedo — útil para verificar
se o smoke entrou em padrão flaky ao longo dos últimos N runs.
