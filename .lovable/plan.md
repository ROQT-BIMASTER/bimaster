

## Diagnóstico

Feedback objetivo: PR-4/5/6 entregaram runtime sólido, mas o **pacote para integradores (SDKs + OpenAPI) não reflete o que o servidor faz**. Lacuna clara entre capacidade do servidor e visibilidade no SDK. Para fechar de 9.5 → 9.8, preciso de 3 PRs cirúrgicos focados em **expor as features ao dev**.

Antes de planejar, preciso confirmar o estado atual dos artefatos client-facing.
<lov-tool-use id="toolu_vrtx_01NHadzeowr5qEFxrQeXs2X3" name="code--search_files" integration-id="code" data="{\"query\": \"deprecated|Sunset|ETag|If-None-Match|RateLimit-Limit|rateLimitRemaining\", \"search_dir\": \"src/components/erp\", \"include_patterns\": \"*.ts,*.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_013vcahcPP3ZL1JJQueZJWiS" name="code--search_files" integration-id="code" data="{\"query\": \"openapi|deprecated|x-sunset\", \"include_patterns\": \"*.json,*.yaml,*.yml\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_011d8DVvnX911FcBftdZG6mP" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"src/components/erp\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01JPL8f28tCL8PDBsjbDDc3o" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"src/components/erp\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01J6JxyjMVhHffo98fQ8Pqbp" name="code--search_files" integration-id="code" data="{\"query\": \"ETag|If-None-Match|RateLimit-Remaining|Sunset|Deprecation\", \"include_patterns\": \"*.ts,*.tsx,*.py,*.js,*.json,*.yaml\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_012vGM7MAyfkqQAU1NisDNav" name="code--search_files" integration-id="code" data="{\"query\": \"openapi|generateOpenApi|openApiSpec\", \"search_dir\": \"src\", \"include_patterns\": \"*.ts,*.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_0112R2P3yEXUFEBcaXZqp5bC" name="code--search_files" integration-id="code" data="{\"query\": \"SDK|generateSdk|sdkGenerator\", \"search_dir\": \"src\", \"include_patterns\": \"*.ts,*.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01TPZJKA5yFPVApuRAENjdFL" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/erp/SdkDownloadButtons.tsx\", \"lines\": \"1-80\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01YRkrqYB4CZPQ8buGbqvgB8" name="code--exec" integration-id="code" data="{\"command\": \"wc -l src/components/erp/SdkDownloadButtons.tsx src/components/erp/ApiDocumentation.tsx\", \"user_facing_description\": \"Verificando tamanho dos arquivos do SDK e OpenAPI\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01FrGy2KyjzjzA3p94MaP4qi" name="code--search_files" integration-id="code" data="{\"query\": \"_request|_requestWithRetry|lastRequestId\", \"search_dir\": \"src/components/erp/SdkDownloadButtons.tsx\"}">
</lov-tool-use>
I have enough context. Let me check the OpenAPI generator section briefly to understand how responses are documented.
<lov-tool-use id="toolu_vrtx_01Vr4bExGvfBxv3N1geg7vva" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/erp/ApiDocumentation.tsx\", \"lines\": \"1690-1760\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_014EuekSVWKeRZaLM9r4x93g" name="code--search_files" integration-id="code" data="{\"query\": \"IdempotencyKey|RequestId|parameters:\", \"search_dir\": \"src/components/erp/ApiDocumentation.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_0173gPteAA1tuX5x9e48Ybyc" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/erp/ApiDocumentation.tsx\", \"lines\": \"1820-1870\"}">
</lov-tool-use>
I have enough context. Let me look at how 2xx responses are built to know where to inject ETag/RateLimit headers.
<lov-tool-use id="toolu_vrtx_01EF9knaFLu2DwBSwXsCxZNq" name="code--search_files" integration-id="code" data="{\"query\": \"success200|\\\"200\\\":|description: \\\"OK\\\"|description: \\\"Sucesso\", \"search_dir\": \"src/components/erp/ApiDocumentation.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01UMHfVzE3EUHdFJjy7bcan6" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/erp/ApiDocumentation.tsx\", \"lines\": \"1640-1695\"}">
</lov-tool-use>
I have enough context. Now let me present the plan.

<lov-plan>

## Diagnóstico

Aprovação da auditoria 9.5/10. O parecer é cirúrgico: **runtime correto, pacote distribuído incompleto**. O dev senior que lê só os SDKs+OpenAPI não vê 3 features que o servidor já entrega. Fechar isso = 9.5 → 9.8.

Três lacunas concretas, todas em arquivos sob meu controle (`SdkDownloadButtons.tsx` e `ApiDocumentation.tsx`):

| Lacuna | Onde | Esforço |
|---|---|---|
| ETag não usado pelos SDKs (sempre baixa body) | 3 SDKs | ~120 linhas |
| RateLimit headers não expostos ao dev | 3 SDKs | ~60 linhas |
| OpenAPI não documenta Sunset/ETag/RateLimit nas responses | OpenAPI generator | ~80 linhas |

Tudo em 1 PR único. Zero migration, zero edge function.

## Escopo PR-7B (DX Closure)

### Etapa 1 — SDKs: ETag + RateLimit (`SdkDownloadButtons.tsx`)

**Bump SDK_VERSION 2.17.0 → 2.18.0.**

#### TypeScript / JavaScript

`HuggsERP` cliente ganha:
- `private _etagCache: Map<string, string>` — chave: `method+path+queryStringNormalizado`, valor: ETag.
- `public lastRateLimit: { limit: number; remaining: number; reset: number } | null = null`.

`_request`:
- Antes de fetch GET: se `_etagCache.has(key)`, adiciona `If-None-Match: <etag>` ao headers.
- Após fetch:
  - Captura headers `RateLimit-Limit/Remaining/Reset` → popula `this.lastRateLimit`.
  - Se status 304: retorna `{ __notModified: true, ...cached }` (cache em memória do último body bem-sucedido por chave). Documentado: GETs cacheáveis devolvem snapshot prévio quando servidor responde 304.
  - Se status 200 com header `ETag`: salva no cache + salva body em `_bodyCache`.

`HuggsAPIError` ganha campos `rateLimitRemaining?: number`, `rateLimitReset?: number` populados quando 429.

#### Python

`HuggsERP` ganha:
- `self._etag_cache: dict = {}`
- `self._body_cache: dict = {}`
- `self.last_rate_limit: dict | None = None`

`_request`:
- GET: `headers["If-None-Match"] = self._etag_cache[key]` se existir.
- Após response: parse `RateLimit-*` → `self.last_rate_limit = {"limit": ..., "remaining": ..., "reset": ...}`.
- 304 → retorna `self._body_cache[key]` com flag `_not_modified=True`.
- 200 + ETag → atualiza ambos os caches.

`HuggsAPIError` ganha `self.rate_limit_remaining` e `self.rate_limit_reset`.

#### Smoke embutido (5 → 7 cases)
Adicionar 2 cases:
- Mock 304 → verifica que SDK retorna body cacheado e `lastRequestId` populado.
- Mock 429 com headers RateLimit-* → `HuggsAPIError.rateLimitRemaining === 0`.

### Etapa 2 — OpenAPI (`ApiDocumentation.tsx`)

**Adicionar 3 headers reutilizáveis em `components.headers`:**
```ts
ETag: { description: "Hash estável do body — use em If-None-Match para 304.", schema: { type: "string" } },
RateLimitLimit: { description: "Limite de chamadas/minuto.", schema: { type: "integer" } },
RateLimitRemaining: { description: "Chamadas restantes na janela atual.", schema: { type: "integer" } },
RateLimitReset: { description: "Unix epoch (s) do reset da janela.", schema: { type: "integer" } },
```

**Adicionar response 304:**
```ts
NotModified: { description: "Recurso inalterado desde a versão indicada por If-None-Match.", headers: { ETag: {$ref: ".../ETag"}, "RateLimit-Limit": ..., "RateLimit-Remaining": ..., "RateLimit-Reset": ... } }
```

**Modificar generator (linhas 1672-1690):**
- Toda response 200/201 ganha bloco `headers` com `X-Request-ID`, `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.
- GETs em paths cacheáveis (`/listar`, `/consultar`, `/status` — mesmo critério do `applyETagByPath` no servidor) ganham:
  - Header `ETag` adicional na response 200.
  - Response `304: {$ref: NotModified}`.
- Endpoints com `deprecated: true` (já marcados) ganham nas responses 2xx os headers `Deprecation` e `Sunset` documentados:
```ts
Deprecation: { description: "true quando endpoint deprecated.", schema: { type: "string", example: "true" } },
Sunset: { description: "Data IMF-fixdate de remoção.", schema: { type: "string", example: "Wed, 30 Sep 2026 23:59:59 GMT" } },
```

### Etapa 3 — Changelog + version bumps

`ApiDocumentation.tsx`:
```
v3.9.1 / SDK v2.18.0 [PR-7B — DX Closure]
- SDKs (TS/JS/Python): ETag/If-None-Match com cache em memória; 304 devolve snapshot.
  Verificável: grep -c "If-None-Match" SDK >= 3 por linguagem.
- SDKs: lastRateLimit (TS/JS) / last_rate_limit (Python) populado a partir dos
  headers RateLimit-{Limit,Remaining,Reset}. HuggsAPIError ganha rateLimitRemaining/reset.
  Verificável: grep -c "lastRateLimit\|last_rate_limit" SDK >= 6.
- OPENAPI: responses 200/201 documentam X-Request-ID + RateLimit-* nos 19 handlers.
  GETs cacheáveis documentam ETag + response 304. Endpoints deprecated documentam
  Deprecation + Sunset. Fecha lacuna SDK ↔ OpenAPI ↔ runtime.
- Smoke embutido: 7 cases (5 anteriores + 1 ETag/304 + 1 RateLimit em 429).
```

`APP_VERSION`: `2.33.0` → `2.33.1`.

### Etapa 4 — Verificação pós-PR

```bash
grep -c "If-None-Match" src/components/erp/SdkDownloadButtons.tsx        # >= 3 (TS/JS/Python)
grep -c "lastRateLimit\|last_rate_limit" src/components/erp/SdkDownloadButtons.tsx  # >= 6
grep -c "RateLimit-Limit\|RateLimit-Remaining\|RateLimit-Reset" src/components/erp/ApiDocumentation.tsx  # >= 6
grep -c "ETag" src/components/erp/ApiDocumentation.tsx                   # >= 4
grep -c '"304"' src/components/erp/ApiDocumentation.tsx                  # >= 1
grep -c "Sunset" src/components/erp/ApiDocumentation.tsx                 # >= 2
```

Smoke runtime (já validado no PR-4/5/6 — não muda):
- `GET /listar` retorna ETag + RateLimit-* + (se legado) Deprecation/Sunset.
- 2ª chamada com `If-None-Match` → 304.

Smoke SDK (manual no console do navegador após download):
- `npx tsx huggs-erp-sdk.ts --smoke` → "[smoke] 7/7 invariantes OK".
- `python huggs_erp_sdk.py --smoke` → "OK (7 tests)".

## Não-escopo

- Cache distribuído (Redis/CDN) para ETag — local já cobre integrador.
- Persistência do `_etagCache` entre processos (in-memory é suficiente para uso típico).
- Alterações em edge functions — runtime está correto (validado no PR-4/5/6).
- PR-7 (REMOVER endpoints v1-legacy) — só após Sunset 2026-09-30.

## Impacto

Fecha as 3 lacunas DX identificadas pelo parecer:
- **ETag**: integrador que faz polling economiza banda real (304 em vez de body completo).
- **RateLimit visível**: dev pode fazer back-off proativo (`if (sdk.lastRateLimit.remaining < 5) await wait()`).
- **OpenAPI fiel**: Postman/openapi-generator/codegen externos enxergam os 3 grupos de headers — features deixam de ser "invisíveis ao gerar cliente".

Edição em 2 arquivos, ~260 linhas. Zero risco runtime (pacote distribuído, não servidor). Nota projetada: **9.5 → 9.8**.

