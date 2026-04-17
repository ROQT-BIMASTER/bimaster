

## Diagnóstico

Pedido: detalhar a auditoria anterior em duas matrizes:
1. **19 FAIL + 1 MISSING** — uma linha por endpoint, com `arquivo:linha`, findings com severidade, e evidência verificável (grep/curl/citação).
2. **13 EXTRA** — classificados em `debug` / `feature-não-documentada` / `legacy`, com recomendação (remover / documentar / descontinuar).

Trabalho **read-only** puro: leitura de Edge Functions + cross-reference contra a OpenAPI inline em `ApiDocumentation.tsx`. Nada novo a executar — o material já foi auditado no ciclo anterior, falta apenas formalizar a evidência por linha.

## Plano de execução

### Fase 1 — Coleta de evidência arquivo:linha (read-only)

Para cada um dos 20 endpoints FAIL/MISSING e 13 EXTRA, ler:
- `supabase/functions/contas-pagar-api/index.ts` (+ `_shared/contas-pagar/*`)
- `supabase/functions/contas-receber-api/index.ts` (+ handlers internos)
- `supabase/functions/lancamentos-cc-api/index.ts`
- `supabase/functions/parcelas-api/index.ts`
- `supabase/functions/erp-export-payment/index.ts`
- `supabase/functions/_shared/response.ts` vs `_shared/contas-pagar/utils.ts`
- `supabase/functions/boletos-api/index.ts` (se existir)

Greps verificáveis a aplicar:
- `grep -c "X-Request-ID" supabase/functions/<f>/index.ts` → confirma observabilidade ausente
- `grep -c "Idempotency-Key" supabase/functions/<f>/index.ts` → confirma idempotência ausente
- `grep -c "estornar" supabase/functions/contas-receber-api/index.ts` → confirma MISSING
- `grep -c "delete-old" supabase/functions/contas-receber-api/index.ts` → confirma EXTRA

### Fase 2 — Matriz 1: FAIL + MISSING (20 linhas)

Formato Markdown, ordenado por severidade ALTA → MÉDIA:

| # | Endpoint | Método | Handler (arquivo:linha) | Findings (severidade) | Evidência |
|---|---|---|---|---|---|
| 1 | `/contas-receber-api/estornar` | POST | **MISSING** | [ALTA] HANDLER_NOT_FOUND | `grep -c "estornar" .../contas-receber-api/index.ts` → 0 |
| 2 | `/contas-receber-api/lancar-recebimento` | POST | `index.ts:NNN` | [ALTA] IDEMPOTENCY_MISSING; [ALTA] X_REQUEST_ID_MISSING | greps + trecho `apiResponse(...)` |
| ... | ... | ... | ... | ... | ... |

Cada linha com:
- Caminho absoluto + range de linhas do handler
- Lista numerada de findings com severidade entre colchetes
- Pelo menos 1 evidência verificável (grep count, curl response capturado, ou citação `linha:código`)

### Fase 3 — Matriz 2: EXTRA (13 linhas)

Classificação tripla:

| # | Endpoint | Handler (arquivo:linha) | Classificação | Risco | Recomendação |
|---|---|---|---|---|---|
| 1 | `/contas-receber-api/delete-old` | `index.ts:NNN` | **debug** ou **feature-não-doc** | ALTA (destrutivo exposto) | **REMOVER** ou mover para admin-only |
| 2 | `/contas-pagar-api/debug-payload` | `infra-handlers.ts:106-160` | **debug** (admin-only JWT) | BAIXA (já protegido) | **DOCUMENTAR** como admin-only ou marcar `x-internal: true` |
| 3 | `/contas-pagar-api/trigger-n8n` | `infra-handlers.ts:64` | **feature-não-doc** | MÉDIA | **DOCUMENTAR** ou marcar interno |
| ... | ... | ... | ... | ... | ... |

Critérios de classificação:
- **debug**: handler com nome `debug-*`, `trigger-*`, `inspect-*`, ou que exige JWT admin
- **feature-não-doc**: endpoint funcional usado pelo frontend mas ausente da OpenAPI pública (ex: `stats`, `last-sync`)
- **legacy**: endpoint funcional mas substituído por equivalente já documentado (ex: `/sync` substituído por `/upsert-lote`)

Recomendação por classe:
- `debug` + protegido → **DOCUMENTAR** como `x-internal: true` no spec
- `debug` + exposto → **REMOVER** ou trancar atrás de JWT admin
- `feature-não-doc` → **DOCUMENTAR** no próximo bump (v3.8.5)
- `legacy` → **DESCONTINUAR** com `deprecated: true` + `x-sunset` no spec

### Fase 4 — Resumo executivo

Após as duas matrizes, bloco curto com:
- **Top 3 fixes prioritários** (ordenados por impacto/esforço)
- **Verificação grep-friendly** para o changelog v3.8.5 quando os fixes forem aplicados (mantém a disciplina de `mem://process/release-changelog-discipline`)

## Não-escopo

- Aplicar correções (auditoria é read-only conforme regra do prompt original).
- Re-rodar smoke tests runtime já capturados na rodada anterior.
- Auditar SDKs de novo — só citar quando o gap SDK aparecer como finding em endpoint FAIL.

## Impacto esperado

Matriz acionável: time pega os 19 FAIL + 1 MISSING, cada um com `arquivo:linha` e grep verificável, e converte em PRs cirúrgicos. Matriz EXTRA define o que vira documentação (v3.8.5), o que vira `deprecated`, e o que sai do código. Sem isso, o relatório anterior fica narrativo demais para servir de backlog.

