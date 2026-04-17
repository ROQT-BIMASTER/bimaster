

## Diagnóstico

A auditoria externa do SDK v3.0.0 / OpenAPI v4.0.0 está **tecnicamente correta**. Validei cada achado:

**Confirmados (precisam ação):**

1. **HMAC helper ausente** (risco ALTO): `grep -c "verifyWebhookSignature\|validateWebhookSignature" SdkDownloadButtons.tsx` = 0. Os 3 SDKs documentam HMAC nos headers (`X-Webhook-Signature: sha256=<hex>`) mas não exportam helper. Cada integrador vai reimplementar — e a maioria vai usar `===` em vez de comparação timing-safe, abrindo vetor de timing attack na borda do cliente. Já temos `_shared/timing-safe.ts` no backend; precisa portar a ideia para os 3 SDKs.

2. **JS sem classes de erro tipadas** (risco MÉDIO): TS tem `HuggsAPIError`, `HuggsValidationError`, `HuggsAuthError`, `HuggsConflictError` (linhas 87-129). Python tem o mesmo set + `HuggsRateLimitError` + `HuggsBusinessError` (linhas 2756-2780+). JS trata erro como objeto genérico — DX assimétrica, integrador JS não consegue `catch (e instanceof HuggsConflictError)`.

3. **Sem matriz OpenAPI ↔ SDK** (risco MÉDIO): 185 endpoints no spec, ~52-67 métodos públicos por SDK. Cobertura ~30% é intencional (foco em fluxos financeiros), mas a falta de matriz explícita confunde o integrador — ele não sabe se um endpoint sem método é "esquecido" ou "use REST direto".

**Confirmados (nice-to-have, valor real):**

4. **Smoke tests só em Python** (risco MÉDIO): 8 cases em Python (`test_01_*` a `test_08_normalization`), zero em TS/JS. Sem CI-gate equivalente.

5. **`getCacheStats()` / `clearCache()`** (risco BAIXO): API de inspeção. Long-running services com LRU bounded em 500 não têm como observar pressão de cache nem invalidar seletivamente.

**Não confirmado / fora de escopo:**

- "Breaking sem deprecation window TS/JS": real, mas é decisão consciente de pre-prod cleanup (regra `mem://process/release-changelog-discipline`). Não vou reverter.

## Plano de execução — PR-8 (SDK v3.1.0 / OpenAPI v4.1.0 / APP v3.1.0)

### Etapa 1 — Helper HMAC nas 3 linguagens (P1, fix do risco ALTO)

`src/components/erp/SdkDownloadButtons.tsx`: adicionar em cada SDK uma função pública estática + standalone export.

**TypeScript** (junto às classes de erro, ~linha 130):
```ts
export async function verifyWebhookSignature(
  rawBody: string, signatureHeader: string, secret: string
): Promise<boolean> {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const received = signatureHeader.slice(7);
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,"0")).join("");
  // Constant-time compare
  if (expected.length !== received.length) return false;
  let r = 0;
  for (let i = 0; i < expected.length; i++) r |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  return r === 0;
}
```

**JavaScript**: idem (sem tipos), ESM com `crypto.subtle`.

**Python**: usa `hmac.compare_digest` (já é timing-safe da stdlib):
```python
def verify_webhook_signature(raw_body: bytes, signature_header: str, secret: str) -> bool:
    import hmac, hashlib
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)
```

Adicionar ao bloco de exemplo no rodapé de cada SDK: snippet de uso com Express/Flask/Hono.

### Etapa 2 — Classes de erro JS espelhando TS/Python (P2)

No bloco JS do `SdkDownloadButtons.tsx`, adicionar antes da classe `HuggsERP`:
```js
export class HuggsAPIError extends Error {
  constructor(status, message, data = {}, requestId, rateLimitRemaining, rateLimitReset) {
    super(`HTTP ${status}: ${message}`);
    this.name = "HuggsAPIError";
    this.status = status; this.code = data.code || "unknown_error";
    this.data = data; this.requestId = requestId;
    this.rateLimitRemaining = rateLimitRemaining; this.rateLimitReset = rateLimitReset;
  }
}
export class HuggsValidationError extends HuggsAPIError { /* status 400 */ }
export class HuggsAuthError extends HuggsAPIError { /* status 401 */ }
export class HuggsConflictError extends HuggsAPIError { /* status 409 */ }
export class HuggsRateLimitError extends HuggsAPIError { /* status 429, retryAfter */ }
export class HuggsBusinessError extends HuggsAPIError { /* status 422 */ }
```

Refatorar bloco `_request` JS para fazer `switch (res.status)` e instanciar a classe certa (paridade com TS linhas 893-897).

### Etapa 3 — `getCacheStats()` + `clearCache(pattern?)` (P5)

Adicionar nas 3 SDKs como métodos de instância:
- TS/JS: `getCacheStats(): { etagEntries: number; bodyEntries: number; maxSize: number }`, `clearCache(pattern?: string | RegExp): number` (retorna entradas removidas).
- Python: `get_cache_stats() -> dict`, `clear_cache(pattern: Optional[str] = None) -> int`.

### Etapa 4 — Smoke tests em TS/JS (P4)

Adicionar bloco `// ===== SMOKE TESTS (Jest/Vitest compatível) =====` no rodapé do TS e JS, replicando os 8 cases do Python:
1. Construtor sem apiKey lança `HuggsValidationError`.
2. Lote vazio rejeitado localmente (`_validate`).
3. Idempotency-Key gerada UMA vez por operação lógica (mock fetch, contar `X-Idempotency-Key` em headers).
4. Retry 5xx preserva idempotency-key.
5. 304 Not Modified devolve cache.
6. RateLimit headers populam `lastRateLimit` em sucesso.
7. RateLimit em 429 → `HuggsRateLimitError` com `rateLimitRemaining=0`.
8. Normalização de cache key (`?a=1&b=2` e `?b=2&a=1` hitam mesma entry).
9. **Novo**: `verifyWebhookSignature` aceita assinatura válida e rejeita inválida (valor + tampering).

Não rodam em CI ainda — ficam como bloco de referência exatamente como Python já está. (Migrar para Jest real é PR separado de tooling, fora do escopo de SDK.)

### Etapa 5 — Matriz de cobertura OpenAPI ↔ SDK (P3)

Criar `docs/SDK_COVERAGE_MATRIX.md` com tabela em 4 colunas: `Endpoint OpenAPI | Método SDK | Cobertura (TS/JS/PY) | Justificativa se ausente`.

Estrutura por categoria:
- **Financeiro core (100% cobertura)**: CP/CR upsert, query, lancar-pagamento/recebimento, estornar, parcelas, anexos.
- **Cadastros base (cobertura parcial)**: clientes, fornecedores, empresas, categorias — métodos principais (`incluir`, `listar`, `consultar`, `alterar`).
- **Lookups via REST direto**: bandeiras, cnae, cidades, paises, tipos-* — listar API REST, sem método dedicado (são read-only e raramente mudam).
- **Webhooks**: subscriptions têm cobertura SDK; dispatcher é interno.
- **ERP integration**: erp-export-payment, erp-fornecedores-* têm cobertura; portadores e plano-contas via REST direto.

No fim: tabela-resumo com `% cobertura por categoria`. Linkar do header dos SDKs (`Documentação: ...`) e do Portal ERP (`ApiDocumentation.tsx` ganha card "Cobertura SDK").

### Etapa 6 — OpenAPI bump v4.0.0 → v4.1.0

`ApiDocumentation.tsx`:
- `info.version` → `4.1.0`.
- Adicionar entry de changelog v4.1.0 descrevendo HMAC helper + matriz de cobertura.
- Webhook section ganha bloco "Validação no consumidor (helper SDK)" com snippet de uso.

### Etapa 7 — Versões + regression script

- `src/lib/version.ts`: APP `3.0.1` → `3.1.0` (minor — features novas, sem breaking).
- `SDK_VERSION` no header dos SDKs: `3.0.0` → `3.1.0`. Adicionar entry de changelog v3.1.0.
- `audit/regression-greps.sh`: adicionar 5 invariantes positivos novos:
```bash
check "verifyWebhookSignature nos 3 SDKs"   "$(grep -c 'verifyWebhookSignature\|verify_webhook_signature' $SDK)" 3
check "JS HuggsRateLimitError exportada"    "$(grep -c 'class HuggsRateLimitError' $SDK)" 2  # JS + TS (Python tem em outra forma)
check "getCacheStats nos SDKs"              "$(grep -c 'getCacheStats\|get_cache_stats' $SDK)" 3
check "clearCache nos SDKs"                 "$(grep -c 'clearCache\|clear_cache' $SDK)" 3
check "Matriz cobertura referenciada"       "$(grep -c 'SDK_COVERAGE_MATRIX' $SDK)" 1
```

E atualizar bloco "Versões alinhadas":
```bash
check "OpenAPI v4.1.0 no spec"   "$(grep -cF '\"4.1.0\"' $SPEC)" 1
check "SDK_VERSION 3.1.0"        "$(grep -cE '3\.1\.0' $SDK)" 3
check "APP_VERSION 3.1.0"        "$(grep -cE '3\.1\.0' $VER)" 1
```

Total: **38 → 43 invariantes**.

### Etapa 8 — Memory update

`mem://process/release-changelog-discipline`: adicionar regra "Toda função criptográfica nova (HMAC, hash, compare) DEVE incluir invariante de paridade entre 3 linguagens no `regression-greps.sh`".

## Não-escopo

- Migrar smoke tests Python para Jest/Vitest real com CI runner (tooling separado).
- Bump major (4.1.0 minor — sem breaking, só adições).
- Republicação em registries (npm/pypi) — manual fora do Lovable.
- Cobertura SDK adicional para os ~118 endpoints OpenAPI não cobertos (decisão de produto).

## Impacto

Fecha as 3 lacunas críticas da auditoria externa: webhook HMAC seguro out-of-the-box, paridade JS/TS/Python em classes de erro, observabilidade de cache. Matriz de cobertura corta perguntas repetidas de integrador novo. ~250 linhas adicionadas no `SdkDownloadButtons.tsx` (~80 por SDK), ~120 linhas em `SDK_COVERAGE_MATRIX.md`, ~5 invariantes novos. Risco zero de regressão (só adições). Nota projetada: **9.85 → 9.95** (DX externa fechada, restando só CI-gate real para 10.0).

