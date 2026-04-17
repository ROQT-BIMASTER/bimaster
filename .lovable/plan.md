

## Diagnóstico

Aprovação condicional do PR-1 com 4 pré-requisitos operacionais. Antes de tocar código, preciso entregar:

1. **Baseline grep rodado hoje** — snapshot v3.8.4 commitado em `audit/baseline-v3.8.4.md` provando estado "antes" (todos os greps da Seção 4.1 → 0 ou FAIL).
2. **Decisão A vs B** sobre janela PR-1 sem PR-2 (staging-only OU flag `X-Feature-Idempotency: not-yet-implemented`).
3. **Telemetria 30 dias** dos 4 endpoints REMOVER (`/delete-old`, `/debug-payload`, `/clear-queue`, `/internal-seed`) via `function_edge_logs` — gate antes do PR-7.
4. **Data Sunset concreta** para v1-legacy: `Wed, 30 Sep 2026 00:00:00 GMT` (alinhada com legacy paths já marcados em v3.8.1).

Com isso resolvido, **PR-1 (P1 + P7)** edita `_shared/response.ts` (~30 linhas) e o efeito propaga automaticamente em 14 handlers que já importam `jsonResponse`/`errorResponse`.

## Escopo (loop default próximo)

### Etapa 0 — Pré-requisitos (esta plan, antes de código)

**0.1 Baseline grep** (`audit/baseline-v3.8.4.md`)
- Rodar os 8 blocos grep da Seção 4.1 contra estado atual.
- Commitar resultado bruto + timestamp + commit hash do HEAD.
- Servirá como prova "antes" para auditoria futura.

**0.2 Telemetria REMOVER** (consulta `function_edge_logs`)
```sql
SELECT request.path, COUNT(*) as hits, MIN(timestamp), MAX(timestamp)
FROM function_edge_logs
CROSS JOIN unnest(metadata) AS m
CROSS JOIN unnest(m.request) AS request
WHERE timestamp > now() - interval '30 days'
  AND (request.path LIKE '%/delete-old%' 
    OR request.path LIKE '%/debug-payload%'
    OR request.path LIKE '%/clear-queue%'
    OR request.path LIKE '%/internal-seed%')
GROUP BY request.path;
```
Resultado anexado ao baseline. Se qualquer COUNT > 0 → bloqueia PR-7 e investiga consumer externo.

### Etapa 1 — PR-1 (P1 + P7): X-Request-ID + error envelope

**Arquivo único: `supabase/functions/_shared/response.ts`**

Mudanças (~30 linhas):

```ts
// Helper novo
function getOrCreateRequestId(req: Request): string {
  return req.headers.get("x-request-id") 
      || req.headers.get("x-correlation-id")
      || crypto.randomUUID();
}

// jsonResponse: aceita/propaga X-Request-ID
export function jsonResponse(body, status, req, options?) {
  const requestId = getOrCreateRequestId(req);
  const cors = getCorsHeaders(req);
  const headers = withSecurityHeaders(
    { ...cors, "Content-Type": "application/json", "X-Request-ID": requestId },
    options?.sensitive ?? (status === 401 || status === 403)
  );
  
  const meta = {
    processed_at: new Date().toISOString(),
    request_id: requestId,  // ← P7: cascata no body
    ...(options?.startMs && { duration_ms: Date.now() - options.startMs }),
  };
  // ... resto igual
}

// errorResponse: idem + request_id obrigatório no body
export function errorResponse(status, code, message, req, startMs?) {
  return jsonResponse(
    { error: code, message, request_id: getOrCreateRequestId(req) },
    status, req, { startMs, sensitive: true }
  );
}
```

**Decisão pendente — janela sem PR-2:**

Recomendo **Opção B (flag temporária)** porque:
- Permite mesclar PR-1 em main e ganhar observabilidade já em produção (acelera debug do próprio PR-2).
- Sinaliza explicitamente a integradores: "X-Request-ID disponível, idempotência ainda não".
- Remoção da flag é 1-line revert quando PR-2 mesclar.

Implementação: helper `markIdempotencyPending(headers)` que adiciona `X-Feature-Idempotency: not-yet-implemented` em respostas de endpoints de escrita financeira (hardcoded list de 9 paths). Removido em PR-2.

Se preferir **Opção A (staging-only)**, simplesmente não mesclo em main até PR-2 estar pronto — sem flag, sem código extra.

### Etapa 2 — Verificação pós-PR-1

Bloco grep da Seção 4.1 P1 + P7:
```bash
grep -c "X-Request-ID" supabase/functions/_shared/response.ts        # → ≥ 2
grep -lr "from \"../_shared/response.ts\"" supabase/functions/*-api/index.ts | wc -l  # → ≥ 14
grep -c "request_id" supabase/functions/_shared/response.ts          # → ≥ 1
```

Smoke runtime via `supabase--curl_edge_functions`:
- `GET /parcelas-api/status` → header `x-request-id: <uuid>` presente
- `GET /parcelas-api/status` com `x-request-id: meu-id-123` → header eco do mesmo valor
- `GET /parcelas-api/incluir` (sem auth) → body 401 contém `request_id`

Diff + resultado dos greps + saída dos curls = entregável final do PR-1.

### Etapa 3 — Sunset header v1-legacy (registrar agora)

Adicionar nota no plano de PR-4: data Sunset = `Wed, 30 Sep 2026 00:00:00 GMT` para v1-legacy, alinhada com `/sync-chunk` e `/bulk-sync` já marcados em v3.8.1.

## Não-escopo

- PR-2 (idempotência) — próximo loop após PR-1 mesclado.
- PR-3 (`/estornar`) — pode paralelizar com PR-1 se aprovado, mas plano atual cobre só PR-1.
- Re-auditoria SDK / Pattern Findings — congelado.

## Impacto

PR-1 fecha 14 endpoints sem `X-Request-ID` + 100% dos error envelopes ganham `request_id` (cascata P7 confirmada). Edição central de ~30 linhas, zero mudança em handlers, baseline registrado, decisão de janela explicitada. Nota projetada: 7.0 → 7.5.

