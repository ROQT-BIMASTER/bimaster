# E2E Aprovações no CI

Workflow: `.github/workflows/e2e-aprovacoes.yml`
Specs: `e2e/aprovacoes/**/*.spec.ts`
Config: `playwright.config.ts`

## O que roda

A cada **push em `main`** e **a cada pull request** (exceto vindos de fork —
secrets indisponíveis), o GitHub Actions executa o spec
`e2e/aprovacoes/aprovacoes-flow.spec.ts` no Chromium headless via Playwright.

Cobertura:
1. Login no preview.
2. `/dashboard/central/aprovacoes` carrega.
3. Drawer de item abre.
4. `HistoricoItemDialog` abre.
5. Comentário vazio mantém botão desabilitado.
6. Comentário válido aparece na timeline + toast de sucesso.

## Secrets necessários

Configurar em **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Descrição |
|---|---|
| `E2E_BASE_URL` | URL do preview Lovable (ex.: `https://id-preview--<id>.lovable.app`) ou staging próprio. |
| `E2E_TEST_EMAIL` | Conta de teste com role suficiente para abrir Aprovações. |
| `E2E_TEST_PASSWORD` | Senha da conta. |

A conta deve ter pelo menos um item visível em `/dashboard/central/aprovacoes`
(criar fixtures de seed se necessário).

## Saídas em caso de falha

- **Screenshots** (`screenshot: only-on-failure`) — anexados ao
  artefato `playwright-test-results-<run_id>`.
- **Vídeo** (`video: retain-on-failure`) — mesmo artefato.
- **Trace** (`trace: retain-on-failure`) — abrir com
  `bunx playwright show-trace <arquivo>.zip`.
- **Relatório HTML** — artefato `playwright-report-<run_id>`,
  abrir com `bunx playwright show-report playwright-report/`.
- **Resumo no PR** — tabela com specs falhos no GitHub Actions Summary
  (gerada via `actions/github-script`).
- Screenshots intermediários (sucesso ou falha) anexados via
  `test.info().attach` em cada `test.step` chave.

## Rodar localmente

```bash
bun install
bunx playwright install --with-deps chromium

export E2E_BASE_URL="http://localhost:8080"
export E2E_TEST_EMAIL="..."
export E2E_TEST_PASSWORD="..."

bunx playwright test                  # roda headless
bunx playwright test --headed         # com janela
bunx playwright test --ui             # modo interativo
bunx playwright show-report           # abre o último HTML report
```

## Concorrência e flake

- `concurrency` cancela execuções antigas no mesmo branch/PR
  (e2e usa dados compartilhados — paralelismo pode gerar race em comentários).
- `retries: 2` no CI cobre flakes de rede / cold start do preview.
- `workers: 1` no CI mantém ordem determinística.

## Debug

Para reproduzir uma falha localmente com o mesmo trace do CI:

```bash
# baixar artefato playwright-test-results-<run_id> do PR
unzip playwright-test-results-<run_id>.zip -d /tmp/results
bunx playwright show-trace /tmp/results/<spec>-chromium/trace.zip
```

## Não regredir

- Não habilitar `fullyParallel: true` sem revisar o seed (mutações em
  `aprovacao_kanban_audit` causariam interferência cruzada).
- Não remover o `if:` que pula PRs de fork — sem secrets, o job falharia
  com falso negativo.
- O placeholder `Escreva uma observação que ficará registrada na timeline…`
  em `HistoricoItemDialog.tsx` é parte do contrato de teste — mudanças
  exigem atualizar o seletor `getByPlaceholder` no spec.
