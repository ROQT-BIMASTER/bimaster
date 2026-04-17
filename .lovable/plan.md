

## Diagnóstico

Aprovação para PR-2 (P2 — Idempotência server-side) com 5 condições operacionais explícitas. Antes de planejar, preciso responder à pergunta de pivot: **PR-1B antes de PR-2 ajuda na observabilidade dos testes?**

**Resposta: Não pivota. Mantém PR-2 primeiro.** Justificativa empírica:

1. Smoke de dedup (Seção 4.2 item 2) compara **hash do body completo** entre 2 requests com mesma `Idempotency-Key`. Não depende de `request_id` para validar comportamento — depende de `sha256sum` igual.
2. Debug de falhas de dedup em CR usa o **`Idempotency-Key`** como correlator natural (já é único por operação). `X-Request-ID` ajudaria, mas não é bloqueante.
3. PR-1B levaria 0.5d a mais hoje + retrabalho zero amanhã (refactor mecânico de 30 linhas). Inverter custaria 0.5d sem ganho proporcional em testabilidade.

Conclusão: **PR-2 agora, PR-1B como cleanup antes de PR-4/5/6**.

## Escopo PR-2 (loop default próximo)

### Etapa 0 — Pré-requisitos (registrar antes de código)

**0.1 Baseline de duplicação atual** (anexar a `audit/baseline-v3.8.4.md` Seção 8):
```sql
SELECT codigo_lancamento_integracao, COUNT(*) as duplicatas
FROM contas_receber
WHERE created_at > NOW() - INTERVAL '7 days'
  AND codigo_lancamento_integracao IS NOT NULL
GROUP BY codigo_lancamento_integracao
HAVING COUNT(*) > 1;
```
Mesmo SQL para `contas_pagar` e `parcelas`. Número atual = "quanto duplicamos hoje". Re-rodar 7 dias pós-merge → diferença = efeito real da fix.

### Etapa 1 — Migration: `api_idempotency_cache`

```sql
CREATE TABLE api_idempotency_cache (
  idempotency_key TEXT NOT NULL,
  endpoint_path TEXT NOT NULL,
  body_hash TEXT NOT NULL,           -- sha256 do body para detectar key reuse com payload diferente
  response_status SMALLINT NOT NULL,
  response_body JSONB NOT NULL,
  response_headers JSONB,             -- opcional, para echo de X-Request-ID original
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  PRIMARY KEY (idempotency_key, endpoint_path)
);

CREATE INDEX idx_idempotency_expires ON api_idempotency_cache (expires_at);
ALTER TABLE api_idempotency_cache ENABLE ROW LEVEL SECURITY;
-- RLS: nenhum acesso direto via PostgREST. Apenas service_role via edge functions.
```

Cron job (`pg_cron` ou edge schedule) para limpar diariamente:
```sql
DELETE FROM api_idempotency_cache WHERE expires_at < NOW();
```

### Etapa 2 — Middleware `_shared/idempotency.ts` (auto-contido, não importa response.ts)

```ts
// _shared/idempotency.ts — Server-side request deduplication (P2)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TTL_HOURS = 24;

export interface IdempotencyResult {
  cached: boolean;
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function checkIdempotency(req: Request, endpointPath: string): Promise<IdempotencyResult> {
  const key = req.headers.get("idempotency-key");
  if (!key) return { cached: false };

  // Validação: 16-128 chars, alfanumérico + hífen
  if (!/^[a-zA-Z0-9-]{16,128}$/.test(key)) {
    throw new Error("INVALID_IDEMPOTENCY_KEY: must be 16-128 alphanumeric chars");
  }

  const supabase = createClient(
    Deno.env.get("VITE_SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const bodyText = await req.clone().text();
  const bodyHash = await sha256(bodyText);

  const { data, error } = await supabase
    .from("api_idempotency_cache")
    .select("body_hash, response_status, response_body, response_headers")
    .eq("idempotency_key", key)
    .eq("endpoint_path", endpointPath)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  if (!data) return { cached: false };

  // Detecta key reuse com body diferente (RFC draft-ietf-httpapi-idempotency-key-header)
  if (data.body_hash !== bodyHash) {
    throw new Error("IDEMPOTENCY_KEY_CONFLICT: same key, different body");
  }

  return {
    cached: true,
    status: data.response_status,
    body: data.response_body,
    headers: data.response_headers as Record<string, string>,
  };
}

export async function storeIdempotency(
  req: Request,
  endpointPath: string,
  status: number,
  body: unknown,
  headers?: Record<string, string>
): Promise<void> {
  const key = req.headers.get("idempotency-key");
  if (!key) return;

  // Apenas cacheia respostas 2xx (erros podem ser transitórios)
  if (status < 200 || status >= 300) return;

  const supabase = createClient(
    Deno.env.get("VITE_SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const bodyText = await req.clone().text();
  const bodyHash = await sha256(bodyText);

  await supabase.from("api_idempotency_cache").upsert({
    idempotency_key: key,
    endpoint_path: endpointPath,
    body_hash: bodyHash,
    response_status: status,
    response_body: body,
    response_headers: headers ?? null,
    expires_at: new Date(Date.now() + TTL_HOURS * 3600 * 1000).toISOString(),
  });
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
```

### Etapa 3 — Integração nos 9 handlers de escrita financeira

Padrão de uso em cada handler (exemplo `contas-receber-api/incluir`):
```ts
import { checkIdempotency, storeIdempotency } from "../_shared/idempotency.ts";

// No início do handler
const idem = await checkIdempotency(req, "/contas-receber-api/incluir");
if (idem.cached) {
  return new Response(JSON.stringify(idem.body), {
    status: idem.status,
    headers: { "Content-Type": "application/json", "Idempotent-Replay": "true" },
  });
}

// ... lógica de negócio ...

const responseBody = { /* ... */ };
const responseStatus = 200;
await storeIdempotency(req, "/contas-receber-api/incluir", responseStatus, responseBody);
return new Response(JSON.stringify(responseBody), { status: responseStatus, ... });
```

9 paths a integrar:
1. POST /contas-receber-api/incluir
2. POST /contas-receber-api/baixar
3. POST /contas-receber-api/cancelar
4. POST /contas-receber-api/estornar (novo do PR-3)
5. POST /contas-pagar-api/incluir
6. POST /contas-pagar-api/baixar
7. POST /contas-pagar-api/cancelar
8. POST /erp-export-payment
9. POST /parcelas-api/incluir

(Nota: `/contas-pagar-api/trigger-n8n` removido da lista original do baseline porque é trigger admin, não escrita financeira de integrador. Ajuste registrado em `audit/baseline-v3.8.4.md`.)

### Etapa 4 — Remoção da flag (mesmo PR, pareamento forte)

Em `_shared/response.ts` deletar:
- Constante `IDEMPOTENCY_PENDING_PATHS` (linhas 12-22)
- Função `isIdempotencyPending()` (linhas 40-47)
- Bloco `if (isIdempotencyPending(req))` em `jsonResponse` (linhas ~70-72)
- Comentário de bloco do header (linhas 5-11)

Total: ~28 linhas removidas. Critério de fechamento PR-2: `grep -c "X-Feature-Idempotency" supabase/functions/_shared/response.ts → 0`.

### Etapa 5 — Verificação pós PR-2

**Greps:**
```bash
grep -c "Idempotency-Key" supabase/functions/_shared/idempotency.ts                  # ≥ 1
grep -lr "from \"../_shared/idempotency.ts\"" supabase/functions/*-api/index.ts | wc -l  # ≥ 4 (CR, CP, ERP, parcelas)
grep -c "X-Feature-Idempotency" supabase/functions/_shared/response.ts               # = 0 (flag removida)
grep -c "checkIdempotency\|storeIdempotency" supabase/functions/contas-receber-api/index.ts  # ≥ 8 (4 handlers × 2 chamadas)
```

**Smoke runtime de dedup** (via `supabase--curl_edge_functions`):
```
K="smoke-pr2-$(date +%s)-$(openssl rand -hex 8)"
R1: POST /contas-receber-api/incluir com Idempotency-Key: $K → 200, body B1
R2: POST /contas-receber-api/incluir com Idempotency-Key: $K (mesmo body) → 200, body B2 idêntico, header Idempotent-Replay: true
R3: POST /contas-receber-api/incluir com Idempotency-Key: $K (body diferente) → 409 IDEMPOTENCY_KEY_CONFLICT
R4: POST /contas-receber-api/incluir SEM Idempotency-Key → 200 (passa, sem cache)
```

Critério: B1 === B2 (sha256), R3 = 409, R4 = 200. **Falha de qualquer item bloqueia merge.**

### Etapa 6 — Atualizar baseline + changelog

Anexar a `audit/baseline-v3.8.4.md` (Seção 9):
- Greps pós-PR-2 (transição esperada)
- Saídas dos 4 curls de smoke
- Contagem de duplicação atual (Etapa 0) para comparação futura
- Confirmação: flag X-Feature-Idempotency removida
- Nota projetada: 7.7 → 8.5

Changelog v3.8.6 em `ApiDocumentation.tsx`:
```
v3.8.6 [PR-2]
- Idempotência server-side em 9 endpoints de escrita financeira (TTL 24h).
- Removida flag X-Feature-Idempotency: not-yet-implemented.
- Verificação: grep -c "Idempotency-Key" _shared/idempotency.ts → ≥ 1
- Verificação: grep -c "X-Feature-Idempotency" _shared/response.ts → 0
```

Bump `APP_VERSION` em `src/lib/version.ts` para `2.32.2`.

## Não-escopo

- PR-1B (CR migration para shared response) — próximo loop, antes de PR-4/5/6.
- PR-4/5/6/7 — congelados.
- Migrar trigger-n8n para idempotência (não é escrita de integrador).
- Cache de respostas de erro (apenas 2xx por design, evita lock-in de erro transitório).

## Impacto

PR-2 fecha **8 findings ALTA de duplicação financeira** + remove flag transitória + entrega 1ª prova empírica de comportamento (smoke de dedup, não só test -f). Risco de duplicação eliminado em 100% dos endpoints de escrita financeira. Edição: 1 migration + 1 helper novo (~120 linhas) + 9 integrações de ~10 linhas cada = ~210 linhas. Nota: 7.7 → 8.5.

