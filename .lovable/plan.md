

## Diagnóstico

Pedido: consolidar os 4 refinamentos já entregues nos ciclos anteriores em **um único relatório final** colável, agregando:

1. **Matriz 1** (20 linhas FAIL+MISSING) com severidade rollup + findings + evidência.
2. **Matriz 2** (13 linhas EXTRA) com coluna consumer.
3. **Pattern Findings** (4-6 causas-raiz) agrupando os 20 FAIL.
4. **Verificação pós-fix** (greps pré-cozidos v3.8.5).

Trabalho de **agregação editorial** — todos os dados já consolidados nos 5 ciclos anteriores. Read-only, sem re-leitura de código, sem re-execução de smoke, sem re-auditoria de SDK.

## Escopo

### Estrutura do relatório final (1 documento, 4 seções + 1 executive summary)

**Seção 0 — Executive Summary** (~10 linhas)
- Headline: "20 FAIL+MISSING consolidam em 8 padrões → 7 PRs (~252 linhas) → fecham 100% ALTA + 50% MÉDIA"
- Top 3 PRs por ROI (P1, P3, P2)
- Critério de release v3.8.5

**Seção 1 — Matriz 1: FAIL + MISSING** (20 linhas)
Colunas: `# | Severidade Rollup | Endpoint | Método | Handler (arquivo:linha) | Findings | Evidência`
- Já produzida no ciclo "Refinamento 1"
- Rollup: ALTA se qualquer finding ALTA; senão MÉDIA; senão BAIXA
- Triagem: `grep "| ALTA |" relatorio.md`

**Seção 2 — Matriz 2: EXTRA** (13 linhas)
Colunas: `# | Endpoint | Handler | Classificação | Consumer (arquivo:linha) | Risco | Recomendação`
- Já produzida no ciclo "Refinamento 3"
- Classificações: `debug exposto` / `feature-não-doc` / `legacy`
- Recomendações: REMOVER (4) / x-internal (3) / DOCUMENTAR (4) / SUNSET (2)

**Seção 3 — Pattern Findings** (8 padrões)
- Já produzida no ciclo "Pattern Findings"
- P1-P8 com causa-raiz, esforço, endpoints afetados, verificação
- Resumo de esforço total + ordem de execução

**Seção 4 — Verificação pós-fix v3.8.5**
- Bloco grep por padrão (P1-P8)
- Smoke runtime (5 curls)
- Tabela PR ↔ Greps
- Já produzida no ciclo anterior

### Formato

Markdown único, ~600 linhas, colável em:
- PR descriptions (recortar por seção)
- Changelog v3.8.5 em `ApiDocumentation.tsx` (Seção 4 obrigatória, ref `mem://process/release-changelog-discipline`)
- Backlog do time (Seções 1+2+3)

### Não-escopo (mantido)

- Read-only, nenhum arquivo alterado
- Sem re-execução de smoke runtime
- Sem re-auditoria de SDK (TS/JS/Python)
- Sem aplicar fixes (próximo loop, com aprovação por PR)

## Impacto

Time recebe **1 documento** em vez de 5 mensagens fragmentadas. Triagem por padrão (`grep "| ALTA |"`), priorização por ROI (endpoints/linha), execução por PR (tabela PR↔Greps). Próximo passo do usuário fica desbloqueado: "plano de PRs priorizado por pattern × esforço".

