

## Diagnóstico

Aprovação para abrir PR-4, PR-5 e PR-6 em paralelo. Os três adicionam helpers distintos a `_shared/response.ts` (sem editar funções existentes), o que torna o merge naturalmente limpo. Vou propor execução **sequencial dentro deste loop** (não paralela em branches), porque:

1. Em ambiente Lovable, eu sou o único "dev" — paralelismo de pessoas não se aplica.
2. Sequência reduz risco de retrabalho: se PR-4 revelar aprendizado sobre o padrão de injeção (como o shim revelou no PR-1B), aplico nos PR-5/6 antes de tocar código.
3. Smoke runtime entre cada PR isola regressão.

Ordem proposta: **PR-4 → PR-5 → PR-6** (do mais simples para o mais complexo, validando o padrão do helper a cada passo).

## Escopo

### PR-4 — Deprecation/Sunset headers (RFC 8594 + draft-ietf-httpapi-deprecation)

**Arquivo: `supabase/functions/_shared/response.ts`**

Adicionar:
```ts
export interface DeprecationOptions {
  sunset: string;       // RFC 7231 IMF-fixdate, ex: "Wed, 30 Sep 2026 23:59:59 GMT"
  successor?: string;   // URL/path do endpoint substituto
  link?: string;        // doc explicativo
}

export function withDeprecation(res: Response, opts: DeprecationOptions): Response {
  const headers = new Headers(res.headers);
  headers.set("Deprecation", "true");
  headers.set("Sunset", opts.sunset);
  if (opts.successor) headers.set("Link", `<${opts.successor}>; rel="successor-version"`);
  if (opts.link) headers.append("Link", `<${opts.link}>; rel="deprecation"`);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
```

**Inventário de handlers legados a marcar** (7 conforme plano original — confirmar in loco):
- `/contas-receber-api/v1-legacy/*` (se existir)
- `/contas-pagar-api/v1-legacy/*`
- Outros endpoints com sufixo `-legacy`, `-old`, ou documentados como deprecated em `ApiDocumentation.tsx`

Data Sunset: **2026-09-30 23:59:59 GMT** (alinha com janela acordada no PR-1).

Aplicação no handler:
```ts
return withDeprecation(jsonResponse(body, 200, req), {
  sunset: "Wed, 30 Sep 2026 23:59:59 GMT",
  successor: "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-receber-api/incluir",
  link: "https://docs.huggsapi.com/migration/v1-to-v2"
});
```

**Verificação:**
```bash
grep -c "withDeprecation" supabase/functions/_shared/response.ts  # ≥ 1
grep -rl "withDeprecation(" supabase/functions/ | wc -l           # ≥ 7
```
Smoke: `curl -sI` em endpoint legado → headers `Deprecation: true`, `Sunset: ...`, `Link: ...`.

### PR-5 — ETag / If-None-Match (RFC 7232)

**Arquivo: `supabase/functions/_shared/response.ts`**

Adicionar variante `jsonResponseWithETag`:
```ts
export async function jsonResponseWithETag(
  body: unknown,
  status: number,
  req: Request,
  options?: { startMs?: number; sensitive?: boolean }
): Promise<Response> {
  // Calcula ETag estável do body (ignora meta.processed_at e meta.duration_ms)
  const stableBody = stripVolatileMeta(body);
  const etag = `"${await sha256Short(JSON.stringify(stableBody))}"`;
  
  // 304 se cliente já tem versão atual
  if (req.headers.get("if-none-match") === etag) {
    const cors = getCorsHeaders(req);
    return new Response(null, {
      status: 304,
      headers: { ...cors, "ETag": etag, "X-Request-ID": getOrCreateRequestId(req) }
    });
  }
  
  const res = jsonResponse(body, status, req, options);
  const headers = new Headers(res.headers);
  headers.set("ETag", etag);
  headers.set("Cache-Control", "private, must-revalidate");
  return new Response(res.body, { status: res.status, headers });
}
```

**Aplicação em GETs de consulta** (read-only, idempotentes):
- `/contas-receber-api/consultar`
- `/contas-receber-api/listar`
- `/contas-pagar-api/consultar`
- `/contas-pagar-api/listar`
- `/parcelas-api/listar`
- `/contas-receber-api/status` (e variantes `/status`)

**Detalhe crítico**: ETag deve ser **estável** entre chamadas idênticas. Como `meta.processed_at` muda a cada request, o helper precisa stripar campos voláteis antes de hashear (caso contrário todo GET retorna ETag novo e `If-None-Match` nunca bate).

**Verificação:**
```bash
grep -c "jsonResponseWithETag" supabase/functions/_shared/response.ts  # ≥ 1
grep -rl "jsonResponseWithETag" supabase/functions/ | wc -l            # ≥ 4

# Smoke runtime:
ETAG=$(curl -sI "$BASE/contas-receber-api/consultar?nCodTitulo=1" | grep -i etag | awk '{print $2}' | tr -d '\r')
curl -s -o /dev/null -w "%{http_code}" -H "If-None-Match: $ETAG" "$BASE/contas-receber-api/consultar?nCodTitulo=1"  # → 304
```

### PR-6 — Rate-limit headers (draft-ietf-httpapi-ratelimit-headers)

**Arquivo: `supabase/functions/_shared/rate-limit.ts`**

Mudar `checkRateLimit()` para retornar metadata em vez de só validar:
```ts
export interface RateLimitMetadata {
  limit: number;
  remaining: number;
  reset: number;  // unix timestamp em segundos
}

export async function checkRateLimit(opts: RateLimitOptions): Promise<RateLimitMetadata> {
  // ... lógica existente ...
  // RPC retorna { allowed, remaining, reset_at }
  if (allowed === false) throw new RateLimitError(metadata);
  return { limit: opts.limit, remaining, reset };
}
```

**Migration**: ajustar `check_and_increment_rate_limit` para retornar JSON com `{allowed, remaining, reset_at}` em vez de boolean. Atualizar `secureHandler` para propagar metadata.

**Arquivo: `supabase/functions/_shared/response.ts`**

Adicionar:
```ts
export function withRateLimitHeaders(res: Response, meta: RateLimitMetadata): Response {
  const headers = new Headers(res.headers);
  headers.set("RateLimit-Limit", String(meta.limit));
  headers.set("RateLimit-Remaining", String(meta.remaining));
  headers.set("RateLimit-Reset", String(meta.reset));
  return new Response(res.body, { status: res.status, headers });
}
```

**Aplicação**: `secureHandler` injeta automaticamente em todas as respostas (uma única edição cobre 19 handlers).

Erro 429 já retorna `Retry-After: 60` — adicionar `RateLimit-Reset` também (mesmo timestamp).

**Verificação:**
```bash
grep -c "RateLimit-Limit\|RateLimit-Remaining\|RateLimit-Reset" supabase/functions/_shared/response.ts  # ≥ 3
curl -sI "$BASE/contas-receber-api/listar" | grep -ci "ratelimit-"  # ≥ 3
```

### Etapa Final — Baseline + Changelog

`audit/baseline-v3.8.4.md` Seção 11/12/13 com greps pré/pós de cada PR + smoke outputs.

Changelog em `ApiDocumentation.tsx`:
```
v3.8.8 [PR-4] Deprecation/Sunset headers em 7 endpoints legados (sunset 2026-09-30).
v3.8.9 [PR-5] ETag/If-None-Match em 6 GETs de consulta — economia de banda em polling.
v3.9.0 [PR-6] RateLimit-Limit/Remaining/Reset universal em 19 handlers.
```

Bump `APP_VERSION`: `2.32.3` → `2.32.4` (PR-4) → `2.32.5` (PR-5) → `2.33.0` (PR-6, minor por adicionar capacidade pública nova).

## Não-escopo

- PR-7 (REMOVER endpoints v1-legacy + SUNSET final) — só após Sunset 2026-09-30 expirar.
- Migrar `cache-control` de outros endpoints — escopo atual é só GETs de consulta financeira.
- Cache distribuído (Redis/CDN) para ETag — local hash é suficiente, CDN é PR futuro.

## Impacto

PR-4: integradores recebem aviso machine-readable de que precisam migrar até Sunset.
PR-5: GETs de consulta passam a permitir 304 — economia de banda significativa em integradores que fazem polling.
PR-6: integradores podem fazer back-off proativo antes de bater 429 (UX de SDK profissional).

Combinado fecha 3 findings MÉDIA da matriz, padrões HTTP modernos (RFC 7232, 8594, draft ratelimit) cobertos. Nota: 8.6 → 8.9.

