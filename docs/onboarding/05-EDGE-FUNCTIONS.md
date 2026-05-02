---
title: Edge Functions
audience: ai-coding-agent
last_updated: 2026-05-02
---

# 05 — Edge Functions

## Padrão obrigatório

Toda função em `supabase/functions/<name>/index.ts` deve seguir:

```ts
import { z } from "https://esm.sh/zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const Body = z.object({
  campo: z.string().min(1).max(500),
}).strict();   // .strict() bloqueia mass-assignment

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 30, rateLimitPrefix: "minha-funcao" },
  async (req, ctx) => {
    const cors = getCorsHeaders(req);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    // ... lógica ...
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
));
```

## `secureHandler`

Arquivo: `supabase/functions/_shared/secure-handler.ts`. Pipeline:

1. **CORS preflight** (responde OPTIONS automaticamente).
2. **WAF L7** (a menos que `skipWaf: true`).
3. **IP blocklist**.
4. **Auth**:
   - `"jwt"` — extrai `userId`, `email` do JWT do usuário.
   - `"apikey"` — extrai `empresaId` da API key (parceiros externos).
   - `"any"` — aceita JWT **ou** API key.
   - `"none"` — pula (use só para webhooks com assinatura própria).
5. **Quarentena de conta** (cache 30s; bloqueia `423` se usuário em quarentena).
6. **MFA enforcement** para admins/gerentes após grace period (`403 MFA_REQUIRED`).
7. **Step-up** se `requireStepUp: "scope"` configurado.
8. **Rate-limit** por IP+user (`429`).
9. **Handler do dev**.
10. **Security headers** + headers `RateLimit-{Limit,Remaining,Reset}` injetados.

Configuração:

```ts
secureHandler({
  auth: "jwt",
  rateLimit: 30,            // req/min; 0 = desabilitado
  rateLimitPrefix: "x",
  skipWaf: false,
  requireStepUp: "export.data",  // opcional
  requireMfa: true,              // opcional (já implícito para admins)
}, handler);
```

Erros são serializados automaticamente:
- `AuthError` → status do erro.
- `RateLimitError` → 429 com `Retry-After: 60`.
- Qualquer outro → 500 com mensagem.

## `config.toml` por função

Arquivo: `supabase/config.toml`. **Não mude `project_id`.** Você pode adicionar:

```toml
[functions.minha-funcao]
verify_jwt = false        # se a função aceita anônimo (use com secureHandler auth: "none")
import_map = "./functions/minha-funcao/import_map.json"
```

A maior parte das funções já é deployada com `verify_jwt = false` e a auth é
feita pelo `secureHandler` — não adicione bloco só para isso.

## Chamando do front

### Não-streaming → `invokeChat` (recomendado p/ IA)

```ts
import { invokeChat } from "@/lib/ai/invokeChat";

const { data, error } = await invokeChat<{ reply: string }>(
  "minha-funcao",
  { campo: valor },
);
if (error) { toast.error(error.userMessage); return; }
```

### Não-streaming → `supabase.functions.invoke` (sem timeout!)

```ts
const { data, error } = await supabase.functions.invoke("minha-funcao", {
  body: { campo: valor },
});
```

> **Atenção**: `supabase.functions.invoke` **não tem timeout no cliente**. Se a
> função travar, o spinner roda para sempre. Para chats de IA, use **sempre**
> `invokeChat`. Para outras chamadas, considere envolver em `Promise.race` com
> timeout próprio.

### Streaming SSE

```ts
const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/minha-funcao`;
const headers = await getAuthHeaders();
const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify({...}) });
// parse linha-a-linha; ver src/hooks/useQAAgent.ts como referência canônica
```

Cuidados:
- Ignore linhas `:` (comentários SSE) e keepalives.
- Re-buffer JSON parcial entre chunks.
- Atualize a **última** mensagem assistant in-place (não crie nova a cada token).
- Trate `[DONE]`, CRLF, flush final, 429, 402.

## Helpers em `_shared/`

| Arquivo | Função |
|---|---|
| `secure-handler.ts` | wrapper principal |
| `ai-gateway-call.ts` | `callAIGateway` + `aiGatewayErrorResponse` |
| `cors.ts` | `getCorsHeaders`, `handleCors` |
| `auth.ts` | `validateJWT`, `validateApiKey`, `validateAnyAuth`, `AuthError` |
| `rate-limit.ts` | `checkRateLimit`, `RateLimitError` |
| `waf.ts` | `wafCheck`, `wafBlockResponse` |
| `security-headers.ts` | `withSecurityHeaders` |
| `security-middleware.ts` | `securityCheck` (IP blocklist) |
| `response.ts` | `applyRateLimitHeaders` |
| `idempotency.ts` | dedup por `Idempotency-Key` |
| `validate.ts` | helpers Zod |
| `error-handler.ts` | normalização |
| `ssrf-guard.ts` | bloqueio de SSRF em fetches externos |
| `timing-safe.ts` | comparação constante para tokens |
| `totp.ts` | TOTP para MFA |
| `webhook-enqueue.ts` | enfileira webhooks com retry |
| `erp-key-validator.ts` | valida chave do ERP Huggs |
| `shipsgo.ts`, `shipsgo-schema.ts` | helpers Shipsgo |

## Lista de funções (resumo por área)

- **AI/Copilot**: `ai-insights`, `ai-creative-studio`, `ai-filter`,
  `ai-map-csv-columns`, `analisar-planilha-ia`, `analyze-*`, `audit-*`,
  `auto-classificar-contas`, `central-copilot*`, `projeto-copilot*`, `qa-agent`,
  `api-support-ai`.
- **Finance**: `auditoria-contas-pagar`, `auditoria-contas-receber`,
  `classificar-categoria-dre`, `classificar-conta-departamento`,
  `classificar-contas-batch`, `classificar-contas-lote`,
  `classificar-contas-pagar-ia`, `bancos-api`, `bandeiras-api`, `boletos-api`,
  `categorias-api`.
- **Trade/Forms**: `analyze-form-responses`, `analyze-gondola-competition`,
  `analyze-shelf-photos`, `analyze-competitor-photo`.
- **Marketing/Influencers**: `agency-strategy-ai`, `analyze-brand-positioning`,
  `analyze-brand-website`, `analyze-comments-sentiment`, `analyze-influencer`,
  `analyze-whatsapp-sentiment`, `apify-bulk-enrich`, `apify-influencer-search`,
  `apify-sync-influencer`.
- **Integrações**: `asana-sync`, `asana-reimport-attachments`, `shipsgo-*`,
  `anexos-api`, `cidades-api`, `clientes-api`.
- **Admin**: `admin-bulk-set-password`, `admin-reset-password`,
  `api-health-check`, `api-sandbox`, `auth-email-hook`.

Sempre que criar uma nova, siga o padrão acima e adicione os secrets via tool.
