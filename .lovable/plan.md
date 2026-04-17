

## Diagnóstico

Aprovação para PR-1B (refactor mecânico de `contas-receber-api` para shared response helpers) com 3 verificações pré-PR + 1 follow-up de observabilidade do PR-2.

## Escopo

### Etapa 0 — Verificações pré-PR-1B (5 min cada)

**0.1 Flag órfã** — `grep -r "X-Feature-Idempotency: not-yet-implemented" supabase/functions/` deve retornar 0. Confirma que remoção do PR-2 foi total.

**0.2 Cleanup schedule** — verificar se `cleanup_expired_idempotency_cache()` está agendada via `pg_cron`. Se não, criar cron a cada 6h:
```sql
SELECT cron.schedule('cleanup-idempotency-cache', '0 */6 * * *', 
  $$ SELECT cleanup_expired_idempotency_cache(); $$);
```

**0.3 Telemetria de degradação** (follow-up PR-2 do feedback do usuário) — adicionar log estruturado em `_shared/idempotency.ts` quando lookup falha:
```ts
console.error("[idempotency] degraded", { 
  reason: err.message, 
  endpoint: endpointPath,
  request_id: req.headers.get("x-request-id") 
});
```
Já existe `console.error("[idempotency] lookup failed, proceeding without cache:", err)` — só padronizar formato JSON-friendly para grep futuro de `idempotency_cache_degraded`.

### Etapa 1 — PR-1B: migrar `contas-receber-api` para shared response

**Arquivo único: `supabase/functions/contas-receber-api/index.ts`**

Mudanças:
1. Adicionar `import { jsonResponse, errorResponse } from "../_shared/response.ts";`
2. Deletar funções locais `jsonResponse` e `errorResponse` (~30-50 linhas).
3. Ajustar chamadas: assinatura `(body, status, req, options)` em vez de variantes locais.
4. Garantir que todos os handlers (`incluir`, `consultar`, `listar`, `baixar`, `cancelar`, `estornar`) passam `req` como 3º argumento.

Efeito automático:
- Header `X-Request-ID` em todas as respostas (cascata P1).
- Body com `meta.request_id` em todas as respostas (cascata P7).
- `/estornar` deixa de ser exceção (elimina trade-off documentado no PR-3).

### Etapa 2 — Verificação pós-PR-1B

```bash
grep -c "function jsonResponse\|function errorResponse" supabase/functions/contas-receber-api/index.ts  # → 0
grep -c 'from "../_shared/response' supabase/functions/contas-receber-api/index.ts                       # → 1
grep -r "X-Feature-Idempotency: not-yet-implemented" supabase/functions/                                 # → 0 (auditoria 0.1)
```

Smoke runtime via `supabase--curl_edge_functions`:
- `GET /contas-receber-api/consultar?nCodTitulo=1` → header `x-request-id` presente
- `POST /contas-receber-api/estornar -d '{"nCodTitulo":999999}'` → body contém `request_id` (era exceção no PR-3, agora normalizado)
- `POST /contas-receber-api/incluir` com `Idempotency-Key` válida → ainda funciona (idempotência intacta)

### Etapa 3 — Atualizar baseline + changelog

`audit/baseline-v3.8.4.md` Seção 10:
- Greps pré (0 de cada flag órfã) e pós (transição CR para shared)
- Confirmação cron cleanup ativo
- Confirmação log estruturado de degradação
- Nota: 8.5 → 8.6

Changelog v3.8.7 em `ApiDocumentation.tsx`:
```
v3.8.7 [PR-1B]
- contas-receber-api migrado para _shared/response.ts (helpers centralizados).
- Observabilidade universal: 19/19 handlers emitem X-Request-ID + request_id no body.
- Follow-up PR-2: log estruturado de degradação do cache + cron cleanup 6h.
- Verificação: grep -c "function jsonResponse" contas-receber-api/index.ts → 0
```

Bump `APP_VERSION` para `2.32.3`.

## Não-escopo

- PR-4/5/6 (deprecation/ETag/rate-limit) — próximos loops.
- PR-7 (REMOVER endpoints + SUNSET v1-legacy) — após PR-4/5/6.
- Migrar `contas-pagar-api`, `parcelas-api`, `erp-export-payment` — verificar se já usam `_shared/response.ts` (parcelas-api já usa, conforme arquivo visto). Se algum ainda tiver helper local, registrar como PR-1C separado.

## Impacto

PR-1B fecha a última lacuna de observabilidade (handler `/estornar` nasce com request_id no body, alinhando com vizinhos), elimina helper duplicado, prepara terreno para PR-4/5/6 editarem `_shared/response.ts` uma vez e propagarem para 19 handlers. Refactor mecânico de ~50 linhas, zero risco funcional. Inclui follow-up curto do PR-2 (log de degradação + cron cleanup). Nota: 8.5 → 8.6.

