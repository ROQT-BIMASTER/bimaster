

## Diagnóstico

Aprovação para PR-3 (P3 — handler `/contas-receber-api/estornar`) com 3 verificações pré-PR a executar antes de tocar código novo:

1. **Regressão grep PR-1** — confirmar transição 0 → ≥2 documentada em `audit/baseline-v3.8.4.md` (ainda não persistida no relatório).
2. **Auditoria do escopo da flag** — confirmar que `X-Feature-Idempotency: not-yet-implemented` está apenas nos 9 paths de escrita financeira, não vazou para handlers de leitura.
3. **Ticket pareado de remoção da flag** — registrar issue rastreável atrelada ao PR-2, não como TODO no código.

Após resolvido, PR-3 implementa `/estornar` em `contas-receber-api/index.ts` (handler novo, ~40 linhas), atualiza OpenAPI em `ApiDocumentation.tsx` e roda smoke runtime.

## Escopo (loop default próximo)

### Etapa 0 — Verificações pós PR-1 (antes de tocar PR-3)

**0.1 Atualizar `audit/baseline-v3.8.4.md`** com bloco "Pós-PR-1":
```bash
grep -c "X-Request-ID" supabase/functions/_shared/response.ts   # esperado ≥ 2
grep -c "request_id" supabase/functions/_shared/response.ts     # esperado ≥ 1
grep -c "X-Feature-Idempotency" supabase/functions/_shared/response.ts  # esperado = 1 (única emissão central)
```
Anexar transição 0 → N observada + commit hash do PR-1.

**0.2 Auditoria de escopo da flag**:
- Listar `IDEMPOTENCY_PENDING_PATHS` em `_shared/response.ts` (conferir 9 paths, todos POST de escrita).
- Buscar uso de `isIdempotencyPending` em handlers — esperado: 0 (helper interno, não exposto).
- Confirmar que GETs (`/consultar`, `/listar`, `/status`) NÃO emitem a flag em smoke runtime.

**0.3 Ticket de remoção da flag** (registrado em `audit/pr-2-followup.md`):
- Título: "PR-2 cleanup — remover X-Feature-Idempotency: not-yet-implemented"
- Ação: deletar `IDEMPOTENCY_PENDING_PATHS` + `isIdempotencyPending()` + bloco `if` em `jsonResponse` (4 linhas)
- Trigger: merge do PR-2 em main
- Owner: mesmo dev do PR-2

### Etapa 1 — PR-3 (P3): handler `/contas-receber-api/estornar`

**Arquivos a editar:**

1. **`supabase/functions/contas-receber-api/index.ts`** — adicionar case no router:
```ts
if (path === "/estornar" && method === "POST") {
  return await handleEstornar(req, supabase, startMs);
}
```
Nova função `handleEstornar` (~30 linhas):
- Validação Zod estrita: `{ nCodTitulo: number, cMotivo?: string }`
- Buscar título por `nCodTitulo`, validar status (não pode estar já estornado/cancelado)
- Atualizar status para `ESTORNADO`, registrar `data_estorno`, `motivo_estorno`
- Retornar via `jsonResponse` (cascata P1+P7 já ativa)
- Erros via `errorResponse` (request_id no body automático)

2. **`src/components/erp/ApiDocumentation.tsx`** — adicionar entrada OpenAPI `/contas-receber-api/estornar` (POST, schema request/response, exemplos).

3. **`docs/API_CONTAS_RECEBER.md`** — adicionar seção `### POST /estornar — EstornarContaReceber` com payload + resposta + códigos de erro.

4. **Changelog v3.8.5** em `ApiDocumentation.tsx` (mem://process/release-changelog-discipline):
```
v3.8.5 [PR-3]
- Novo: POST /contas-receber-api/estornar (era 404 de rota)
- Verificação: grep -c 'case "estornar"' contas-receber-api/index.ts → ≥ 1
```

### Etapa 2 — Verificação pós PR-3

```bash
grep -c 'case "estornar"\|path === "/estornar"' supabase/functions/contas-receber-api/index.ts  # ≥ 1
grep -c "/estornar" src/components/erp/ApiDocumentation.tsx                                      # ≥ 1
grep -c "/estornar" docs/API_CONTAS_RECEBER.md                                                   # ≥ 1
```

Smoke runtime via `supabase--curl_edge_functions`:
- POST `/contas-receber-api/estornar` sem body → 400 + body com `request_id` (testa cascata P1+P7 em handler novo)
- POST com `nCodTitulo: 999999` → 404 de domínio (`cCodStatus: 1`, não 404 de router)
- POST com título válido → 200 + status=ESTORNADO

### Etapa 3 — Atualizar relatório de progresso

Anexar a `audit/baseline-v3.8.4.md`:
- Bloco pós-PR-3 com greps acima e códigos HTTP dos 3 curls
- Confirmação: handler novo nasce com X-Request-ID (prova empírica de que cascata PR-1 cobriu padrão de importação)
- Nota projetada: 7.5 → 7.7

## Não-escopo

- PR-2 (idempotência) — fica para próximo loop.
- PR-4/5/6 (deprecation/etag/rate-limit) — congelados.
- Refatoração de outros handlers de CR.
- Migration de schema (estorno reusa colunas existentes `status` + campos de auditoria já presentes).

## Impacto

PR-3 fecha o único finding **funcional** ALTA da matriz (rota documentada que retorna 404). Independente do PR-2, paralelizável. Confirma empiricamente que cascata do PR-1 funciona em handler novo (extra benefício diagnóstico). Edição cirúrgica em 3 arquivos, ~40 linhas de código + 20 linhas de doc. Nota: 7.5 → 7.7.

