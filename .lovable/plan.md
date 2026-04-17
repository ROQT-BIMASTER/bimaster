

## Diagnóstico

Os 5 ajustes do feedback são todos fundamentados e cabem em uma única iteração do PR-7B. Status atual: SDKs 2.18.0 já têm cache + lastRateLimit (commitado), faltam (a) bounds, (b) normalização, (c) opção `cacheBody`, (d) tipos exportados, (e) OpenAPI v3.9.1 + APP_VERSION 2.33.1 + changelog, (f) Python smoke 7/7 + smoke#8 de normalização.

## Escopo PR-7B (fechamento — 5 ajustes)

### 1. LRU bound em `_etagCache` e `_bodyCache` (TS/JS/Python)

Implementação inline (sem dependência externa) — Map em ordem de inserção é LRU natural se fizermos delete+set no get:

```typescript
class LRUMap<K,V> {
  constructor(private max = 500) {}
  private m = new Map<K,V>();
  get(k: K) { const v = this.m.get(k); if (v !== undefined) { this.m.delete(k); this.m.set(k, v); } return v; }
  set(k: K, v: V) { if (this.m.has(k)) this.m.delete(k); else if (this.m.size >= this.max) this.m.delete(this.m.keys().next().value); this.m.set(k, v); }
  has(k: K) { return this.m.has(k); }
  get size() { return this.m.size; }
}
```

Python: classe equivalente usando `collections.OrderedDict` + `move_to_end`.

### 2. Normalização rigorosa da chave de cache

Função `cacheKey(method, path, query)`:
- Separa path de querystring
- Faz parse da QS, ordena entries por chave (localeCompare)
- Reconstrói querystring canônica
- Retorna `${method}:${path}?${sorted}`

Aplicar **antes** de qualquer get/set em ambos caches. Garante que `?a=1&b=2` e `?b=2&a=1` mapeiam pra mesma chave.

### 3. Opção `cacheBody` no constructor

```typescript
constructor(opts: { apiKey: string; baseUrl?: string; cacheBody?: boolean } = ...)
this._cacheBody = opts.cacheBody ?? true;
```

Comportamento:
- `cacheBody: true` (default, atual): 304 → devolve snapshot com `__notModified: true`. Magic on.
- `cacheBody: false`: 304 → devolve `{ __notModified: true, etag, status: 304 }` SEM body. Integrador trata.

ETag cache continua ativo nos dois modos (sempre envia If-None-Match). Só o `_bodyCache` é condicional. Documentar nos comentários inline do SDK.

### 4. Tipos exportados (`RateLimitMetadata`)

TS: `export interface RateLimitMetadata { limit: number; remaining: number; reset: number }` — anotar `lastRateLimit: RateLimitMetadata | null`.

Python: `class RateLimitMetadata(TypedDict, total=False)` + `last_rate_limit: Optional[RateLimitMetadata]`.

### 5. OpenAPI v3.9.1 + APP_VERSION 2.33.1 + changelog grep-verificável

`ApiDocumentation.tsx`:
- `components.headers`: ETag, RateLimitLimit, RateLimitRemaining, RateLimitReset, Deprecation, Sunset (com `$ref` reuse).
- `components.responses.NotModified`: 304 com headers ETag + RateLimit-*.
- Generator de paths:
  - Toda response 200/201 ganha `headers: { "X-Request-ID": ..., "RateLimit-Limit": ..., "RateLimit-Remaining": ..., "RateLimit-Reset": ... }`.
  - Paths cacheáveis (`/listar`, `/consultar`, `/status`): + `headers.ETag` em 200, + response `"304": {$ref: "#/components/responses/NotModified"}`.
  - Endpoints `deprecated: true`: + `headers.Deprecation` + `headers.Sunset` em 2xx.
- Bump versão da spec: `info.version: "3.9.1"`.
- Description da spec: append "v3.9.1: documenta headers ETag, RateLimit-*, Deprecation, Sunset emitidos pelo runtime desde v3.8.8".

`src/lib/version.ts`: `APP_VERSION = '2.33.1'`.

Changelog em `ApiDocumentation.tsx` (entrada nova, formato discipline mem://process/release-changelog-discipline):
```
v3.9.1 / SDK v2.18.0 / APP v2.33.1 [PR-7B — DX Closure final]
- SDKs (TS/JS/Python): LRU bound (max 500) em _etagCache e _bodyCache → previne memory leak.
- SDKs: normalização canônica de querystring (sort por chave) → cache hit estável.
- SDKs: opção cacheBody (default true). Quando false, 304 não devolve body — integrador gerencia.
- SDKs: tipo RateLimitMetadata exportado (TS interface, Python TypedDict).
- OpenAPI v3.9.1: documenta headers ETag, RateLimit-{Limit,Remaining,Reset}, Deprecation, Sunset
  + response 304 NotModified em GETs cacheáveis. Fecha gap servidor/SDK/spec.
- Smoke 7→8 cases: case#8 valida que ?a=1&b=2 e ?b=2&a=1 hitam o mesmo cache.
- Verificações grep:
  grep -c "LRUMap\|OrderedDict" src/components/erp/SdkDownloadButtons.tsx  # >= 2
  grep -c "cacheBody" src/components/erp/SdkDownloadButtons.tsx            # >= 6
  grep -c "RateLimitMetadata" src/components/erp/SdkDownloadButtons.tsx    # >= 4
  grep -c "info.version.*3.9.1\|\"3.9.1\"" src/components/erp/ApiDocumentation.tsx  # >= 1
  grep -c "NotModified" src/components/erp/ApiDocumentation.tsx            # >= 2
  grep -c "smoke#8" src/components/erp/SdkDownloadButtons.tsx              # >= 2
```

### 6. Smoke Python 7/7 + smoke#8 nos 3 SDKs

Python (faltava da iteração anterior):
- case#6: 304 retorna body cacheado + `_not_modified=True`.
- case#7: 429 popula `last_rate_limit` e `HuggsAPIError.rate_limit_remaining`.

Todos os 3 SDKs:
- case#8: dois GETs com queries equivalentes em ordens diferentes → `_etag_cache` (ou `_etagCache`) tem `size === 1`.

## Verificação pós-PR

```bash
# LRU bounds
grep -c "LRUMap\|OrderedDict" src/components/erp/SdkDownloadButtons.tsx          # >= 2

# Normalização
grep -c "cacheKey\|sorted.*query\|sort.*entries" src/components/erp/SdkDownloadButtons.tsx  # >= 3

# cacheBody opt
grep -c "cacheBody\|cache_body" src/components/erp/SdkDownloadButtons.tsx        # >= 6

# Tipos
grep -c "RateLimitMetadata" src/components/erp/SdkDownloadButtons.tsx            # >= 4

# OpenAPI v3.9.1
grep -c '"3.9.1"' src/components/erp/ApiDocumentation.tsx                        # >= 1
grep -c "NotModified" src/components/erp/ApiDocumentation.tsx                    # >= 2
grep -c '"304"' src/components/erp/ApiDocumentation.tsx                          # >= 1

# Smoke#8
grep -c "smoke#8\|normalization" src/components/erp/SdkDownloadButtons.tsx       # >= 3
```

## Não-escopo

- Cache distribuído / persistente entre processos.
- PR-7 (remoção física de legacy paths) — só pós Sunset 2026-09-30.
- Republicação dos SDKs em registries públicos (npm/pypi).
- Edge functions — sem alteração (runtime já correto desde PR-4/5/6).

## Impacto

Fecha as 5 lacunas de robustez levantadas. SDK fica production-grade para serviços long-running (LRU), correto sob queries dinâmicas (normalização), flexível para integradores memory-sensitive (cacheBody), tipado completo (RateLimitMetadata exportado), e OpenAPI passa a refletir 100% do que servidor emite. Edição em 2 arquivos, ~300 linhas. Zero risco runtime. Nota projetada: **9.5 → 9.8**.

