# PR-2 Follow-up — Cleanup da flag temporária

**Criado em:** 2026-04-17 (durante PR-1)
**Trigger de execução:** merge do PR-2 (Idempotency middleware) em main
**Owner:** mesmo dev do PR-2
**Estimativa:** 5 minutos (1-line revert + verificação)

---

## Contexto

O PR-1 introduziu uma flag transitória `X-Feature-Idempotency: not-yet-implemented` em
9 endpoints de escrita financeira para sinalizar a integradores que o header
`Idempotency-Key` (já enviado pelo SDK desde v2.x) ainda é **ignorado** server-side.

Isso evita a "pegadinha silenciosa" identificada na revisão da Opção A vs B:
integrador montar retry com Idempotency-Key acreditando que o servidor desduplica,
quando na verdade ainda duplica.

## Ação a executar quando PR-2 mesclar

Em `supabase/functions/_shared/response.ts`, **deletar**:

1. Constante `IDEMPOTENCY_PENDING_PATHS` (linhas 12-22 — 11 linhas)
2. Função `isIdempotencyPending()` (linhas 40-47 — 8 linhas)
3. Bloco condicional dentro de `jsonResponse`:
   ```ts
   if (isIdempotencyPending(req)) {
     baseHeaders["X-Feature-Idempotency"] = "not-yet-implemented";
   }
   ```
4. Comentário de bloco do header explicativo (linhas 5-11 — 7 linhas)

Total: ~28 linhas removidas. Revert é cirúrgico.

## Verificação pós-cleanup

```bash
grep -c "X-Feature-Idempotency" supabase/functions/_shared/response.ts  # → 0
grep -c "IDEMPOTENCY_PENDING_PATHS" supabase/functions/_shared/response.ts  # → 0
grep -c "isIdempotencyPending" supabase/functions/_shared/response.ts  # → 0
```

Smoke runtime:
```bash
# POST /contas-receber-api/incluir → header X-Feature-Idempotency NÃO presente
# POST /contas-receber-api/incluir com Idempotency-Key duplicada → 200 (segunda chamada retorna cached)
```

## Lista de paths atualmente afetados pela flag

1. POST /contas-receber-api/incluir
2. POST /contas-receber-api/baixar
3. POST /contas-receber-api/cancelar
4. POST /contas-pagar-api/incluir
5. POST /contas-pagar-api/baixar
6. POST /contas-pagar-api/cancelar
7. POST /erp-export-payment
8. POST /parcelas-api/incluir
9. POST /contas-pagar-api/trigger-n8n

Estes 9 paths devem TODOS ganhar idempotência real no PR-2 (middleware compartilhado +
tabela `idempotency_keys` + TTL 24h). A remoção da flag é o último commit do PR-2.

## Changelog suggestion (PR-2)

```
v3.8.6 [PR-2]
- Idempotência server-side em 9 endpoints de escrita financeira (TTL 24h).
- Removida flag X-Feature-Idempotency: not-yet-implemented.
- Verificação: grep -c "X-Feature-Idempotency" _shared/response.ts → 0
```
