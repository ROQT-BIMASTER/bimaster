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
| `avatares-seguidores-papeis.spec.ts` | — | Valida avatares e contador `+N` de seguidores para **dono / membro / convidado**, garantindo fallback textual e nenhum `<img>` quebrado sob RLS. Requer `E2E_OWNER_*`, `E2E_MEMBER_*` e (opcional) `E2E_GUEST_*` + `E2E_SEGUIDORES_IDS` (CSV, ≥4 para exercitar o `+N`). |
| `avatar-fallback-imagem-quebrada.spec.ts` | — | Bloqueia por `page.route()` toda imagem do bucket `avatars` (força 404) e valida que cada `SmartAvatar` desmonta o `<img>`, mantém `title` = `aria-label`(root) = `aria-label`(fallback) e propaga o sufixo `— foto indisponível`. Requer `E2E_OWNER_*` + `E2E_PROJETO_ID` + `E2E_SECAO_ID`. |

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

# Baseline visual completo (todas as telas)
bunx playwright test e2e/projetos/baseline-screenshots.spec.ts

# Atualizar baselines (após mudança visual INTENCIONAL aprovada)
bunx playwright test e2e/projetos/baseline-screenshots.spec.ts --update-snapshots
```

### Primeira captura (PR-C0) — pular o detalhe

Na **primeira rodada** do `--update-snapshots`, deixe `E2E_PROJETO_ID` **DESCONFIGURADO** e capture apenas as 5 rotas agregadas (listagem, central, minhas-tarefas, minha-equipe, relatórios). Motivo: o detalhe (kanban/lista/cronograma) é altamente sensível a edições em tarefas/datas/responsáveis de projetos ativos — sem um projeto fixture estável, a baseline vira a cada hora e gera falso positivo nos PRs C1+. As 5 rotas agregadas, em contraste, mudam pouco com edits individuais.

```bash
# Captura inicial sem detalhe
unset E2E_PROJETO_ID   # garante que os blocos de detalhe são skipados
bunx playwright test e2e/projetos/baseline-screenshots.spec.ts --update-snapshots
```

Depois de criar um projeto fixture (sem edição esperada durante a Fase C) e setar `E2E_PROJETO_ID`, rode um update separado para capturar baselines de detalhe — idealmente num PR `C0.1` ou junto com o primeiro refactor que toca em detalhe (`C1b` ou similar).

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
- Antes de rodar `--update-snapshots`, dê uma passada visual rápida
  nas PNGs geradas (30s, só procurando estado de erro/skeleton)
  antes de commitar — uma baseline ruim contamina todos os PRs
  seguintes da Fase C.
