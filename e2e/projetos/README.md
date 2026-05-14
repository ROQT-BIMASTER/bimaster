# E2E Projetos — Baseline PR-C0

Suíte criada como **pré-requisito da Fase C** do plano de auditoria
2026-05 do módulo Projetos. Antes de decompor `ProjetoTarefaDetalhe`
(1.408 LOC), `ProjetoTarefaRow` (933 LOC) e `TarefaFocusMode` (999 LOC),
precisamos de uma rede de segurança que detecte regressões.

## Specs

| Arquivo | Tag | Propósito |
|---|---|---|
| `00-smoke-projetos.spec.ts` | `@smoke` | Garante que as rotas principais carregam sem crash. Roda em poucos segundos. |
| `baseline-screenshots.spec.ts` | `@baseline` | Captura golden screenshots `fullPage` das telas-alvo da Fase C. |

## Variáveis de ambiente

```bash
E2E_BASE_URL=https://id-preview--<id>.lovable.app
E2E_TEST_EMAIL=...
E2E_TEST_PASSWORD=...
# Opcional — sem ele, smoke/screenshots de detalhe são skipados
E2E_PROJETO_ID=<uuid-de-projeto-com-tarefas>
```

## Comandos

```bash
# Smoke (rápido — usar em todo PR da Fase C)
bunx playwright test e2e/projetos/00-smoke-projetos.spec.ts --grep @smoke

# Baseline visual completo
bunx playwright test e2e/projetos/baseline-screenshots.spec.ts

# Atualizar baselines (após mudança visual INTENCIONAL aprovada)
bunx playwright test e2e/projetos/baseline-screenshots.spec.ts --update-snapshots
```

## Fluxo recomendado para cada PR da Fase C

1. Antes de abrir o PR: rodar `--grep @smoke` localmente — deve passar.
2. Rodar `baseline-screenshots.spec.ts` — qualquer diff visual aparece
   no relatório HTML (`playwright-report/`).
3. Se o diff for **involuntário**: o refactor introduziu regressão
   visual — corrigir antes do merge.
4. Se o diff for **intencional**: justificar no PR e rodar
   `--update-snapshots` para atualizar as baselines no mesmo commit.

## Notas

- `mask` está vazio por padrão. Adicione locators de elementos
  dinâmicos (datas relativas tipo "há 3 minutos", contadores de
  notificações, avatares com URL assinada) conforme aparecerem como
  fonte de flakiness.
- `maxDiffPixelRatio: 0.02` tolera 2% de variação de antialias entre
  ambientes headless. Aumente apenas se necessário.
- Baselines ficam em `e2e/projetos/__screenshots__/` e devem ser
  versionadas no Git para comparação determinística no CI.
