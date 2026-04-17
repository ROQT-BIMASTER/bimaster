# Baseline v3.8.4 — Pré PR-1

**Timestamp:** 2026-04-17T20:27:58Z
**Escopo:** Estado ANTES do PR-1 (P1 + P7). Todos os greps abaixo devem retornar 0 ou valor baixo.

---

## P1 — X-Request-ID em _shared/response.ts
```
$ grep -c "X-Request-ID" supabase/functions/_shared/response.ts
0
0
```

## P1 — Handlers que importam response.ts
```
$ grep -lr "_shared/response" supabase/functions/*-api/index.ts | wc -l
29
```

## P7 — request_id no body do error envelope
```
$ grep -c "request_id" supabase/functions/_shared/response.ts
0
0
```

## P2 — Idempotency-Key em _shared/idempotency.ts
```
$ test -f supabase/functions/_shared/idempotency.ts && grep -c "Idempotency-Key" supabase/functions/_shared/idempotency.ts || echo "FILE NOT FOUND"
FILE NOT FOUND
```

## P3 — Endpoint /estornar em contas-receber-api
```
$ grep -c "estornar" supabase/functions/contas-receber-api/index.ts
0
0
```

## P4 — Header Deprecation em _shared/response.ts
```
$ grep -c "'Deprecation':" supabase/functions/_shared/response.ts
0
0
$ grep -c "\"Deprecation\":" supabase/functions/_shared/response.ts
0
0
```

## P5 — ETag helper em _shared/response.ts
```
$ grep -ci "etag" supabase/functions/_shared/response.ts
0
0
```

## P6 — Rate-Limit headers em _shared/rate-limit.ts
```
$ grep -c "X-RateLimit-" supabase/functions/_shared/rate-limit.ts
0
FILE NOT FOUND
```

---

## Resumo

| Padrão | Esperado (antes) | Observado | Status |
|---|---|---|---|
| P1 X-Request-ID em response.ts | 0 | 0
0 | INESPERADO |
| P1 handlers que importam response.ts | ≥14 | 29 | reference |
| P7 request_id em response.ts | 0 | 0
0 | INESPERADO |
| P3 /estornar em CR | 0 | 0
0 | INESPERADO |
| P4 Deprecation header | 0 | 0
0 | INESPERADO |
| P5 ETag helper | 0 | 0
0 | INESPERADO |
