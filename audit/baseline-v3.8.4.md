# Baseline v3.8.4 — Pré PR-1 (P1 + P7)

**Timestamp:** 2026-04-17T20:28:40Z
**Escopo:** Snapshot do estado ANTES do PR-1, para comprovar transição 0 → ≥N nos greps pós-merge.
**Política:** Read-only. Nenhum arquivo alterado nesta etapa.

---

## 1. Greps de baseline (Seção 4.1 do relatório v3.8.5)

| Padrão | Grep | Esperado (antes) | Observado | Status |
|---|---|---|---|---|
| P1 | `grep -c "X-Request-ID" _shared/response.ts` | 0 | 0 | ✅ BASELINE-OK |
| P1 | handlers que importam response.ts | ≥14 | **29** | ℹ️ reference (inflação propagará automaticamente) |
| P7 | `grep -c "request_id" _shared/response.ts` | 0 | 0 | ✅ BASELINE-OK |
| P2 | _shared/idempotency.ts existe | MISSING | MISSING | ✅ BASELINE-OK |
| P3 | `grep -c "estornar" CR/index.ts` | 0 | 0 | ✅ BASELINE-OK |
| P4 | `grep -c '"Deprecation":' _shared/response.ts` | 0 | 0 | ✅ BASELINE-OK |
| P5 | `grep -ci "etag" _shared/response.ts` | 0 | 0 | ✅ BASELINE-OK |
| P6 | _shared/rate-limit.ts `X-RateLimit-` | 0/MISSING | 0 | ✅ BASELINE-OK |

**Conclusão baseline:** 7/7 padrões em estado pré-fix confirmado. P1B (29 handlers) supera o ≥14 estimado — boa notícia: cascata do PR-1 propaga em mais lugares do que projetado.

---

## 2. Telemetria 30 dias — endpoints REMOVER (gate PR-7)

Consulta executada em `function_edge_logs`:

```sql
SELECT request.path, COUNT(*) FROM function_edge_logs
WHERE timestamp > now() - 30d
  AND path LIKE ANY ('%/delete-old%','%/debug-payload%','%/clear-queue%','%/internal-seed%')
GROUP BY path;
```

**Resultado:** `[]` — **0 hits em 30 dias para todos os 4 paths**.

| Endpoint | Hits 30d | Decisão |
|---|---|---|
| /delete-old | 0 | ✅ REMOVER liberado em PR-7 |
| /debug-payload | 0 | ✅ REMOVER liberado em PR-7 |
| /clear-queue | 0 | ✅ REMOVER liberado em PR-7 |
| /internal-seed | 0 | ✅ REMOVER liberado em PR-7 |

Nenhum consumer externo detectado. Gate de telemetria do PR-7 satisfeito.

---

## 3. Decisão operacional — janela PR-1 sem PR-2

**Escolha: Opção B — flag temporária `X-Feature-Idempotency: not-yet-implemented`**

Justificativa:
- Permite mesclar PR-1 em main e ganhar observabilidade já em produção.
- Acelera debug do próprio PR-2 (cada falha de idempotência terá request_id correlacionável).
- Sinaliza explicitamente a integradores: `X-Request-ID` disponível, idempotência ainda não.
- Remoção da flag em PR-2 é 1-line revert.

Endpoints de escrita financeira que ganham a flag (9 paths):
1. POST /contas-receber-api/incluir
2. POST /contas-receber-api/baixar
3. POST /contas-receber-api/cancelar
4. POST /contas-pagar-api/incluir
5. POST /contas-pagar-api/baixar
6. POST /contas-pagar-api/cancelar
7. POST /erp-export-payment
8. POST /parcelas-api/incluir
9. POST /contas-pagar-api/trigger-n8n

---

## 4. Sunset header v1-legacy

**Data definida: `Wed, 30 Sep 2026 00:00:00 GMT`**

Alinhada com sunset de `/sync-chunk` e `/bulk-sync` já marcados em v3.8.1. Aplicada em PR-4 (Deprecation/Sunset helper).

---

## 5. Próximo passo

Liberado para executar **PR-1 (P1 + P7)**: edição central em `_shared/response.ts` (~30 linhas).
Cascata esperada: 29 handlers que importam o módulo ganham X-Request-ID + request_id no body sem alteração local.
