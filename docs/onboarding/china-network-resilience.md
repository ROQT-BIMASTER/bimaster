---
title: Resiliência de Rede para Usuários na China Continental
audience: ai-coding-agent, devops
last_updated: 2026-05-12
---

# China Network Resilience — Módulo Fábrica China

## TL;DR

A IA do módulo Fábrica China **funciona** para usuários na China continental,
porque **todas** as chamadas a `ai.gateway.lovable.dev` (e a OpenAI/Google por
trás) são feitas **server-side**, a partir das Edge Functions (Deno Deploy
fora da China). Os geo-blocks da OpenAI (jul/2024) e do Google Gemini **não se
aplicam** ao IP de origem dos nossos edges.

O risco real é o **navegador na China alcançar nossos hosts**. Mitigamos com:

1. Domínio `china.bimaster.online` em Cloudflare (mais tolerado que `*.supabase.co`).
2. Cloudflare Worker faz proxy reverso `/api/functions/<name>` → Edge Function,
   eliminando a necessidade do front bater em `*.supabase.co` diretamente.
3. Mensagens de erro multilíngues (PT/EN/ZH) com texto específico para
   latência alta na rede CN.
4. Telemetria via header `x-client-country` (propagado pelo Worker a partir
   de `cf.country`).

## Mapa de tráfego

```text
                      ┌────────────────────────────────────────────┐
Browser (CN) ──TLS──▶ │  Cloudflare Worker (china.bimaster.online) │
                      └────────────────────────────────────────────┘
                              │                       │
                              │ /                     │ /api/functions/<name>
                              ▼                       ▼
                  bimaster.lovable.app   aokkyrgaqjarhlywhjju.supabase.co
                       (SPA static)              /functions/v1/<name>
                                                       │
                                                       ▼
                                        ai.gateway.lovable.dev
                                                       │
                                                       ▼
                                       Google Gemini  /  OpenAI
                                       (chamada de IP US/EU
                                        do Deno Deploy — sem geo-block)
```

## Status de bloqueio (jan/2026, fontes citadas)

| Host | Bloqueado em CN? | Notas |
|---|---|---|
| `openai.com` API | **Sim** (geo-block do provider) | OpenAI bloqueia tráfego CN/HK desde jul/2024 ([SCMP], [Caixin], [PCMag]). Não nos atinge: chamada parte do edge. |
| `generativelanguage.googleapis.com` (Gemini) | **Sim** | CN/HK fora da [lista oficial de regiões][gemini-regions]. Idem: parte do edge. |
| `ai.gateway.lovable.dev` | Não conhecido | CDN Cloudflare; sem geo-block do gateway. |
| `*.supabase.co` | **Intermitente** | Histórico de bloqueio reportado em [GreatFire] e [supabase#2631]. Por isso preferimos o Worker proxy. |
| `*.lovable.app` | Variável | Cloudflare/Netlify; throttling esperado. |
| `china.bimaster.online` | Acessível com latência alta | Cloudflare é tolerado pela GFW (TLS SNI + ECH ajudam). |

[SCMP]: https://www.scmp.com/tech/policy/article/3267971/tech-war-openai-further-block-access-mainland-china-hong-kong-based-developers
[Caixin]: https://www.caixinglobal.com/2024-06-26/openai-enforces-harsher-api-restrictions-on-unsupported-countries-102209858.html
[PCMag]: https://www.pcmag.com/news/openai-to-clamp-down-on-access-for-users-in-china-unsupported-regions
[gemini-regions]: https://ai.google.dev/gemini-api/docs/available-regions
[GreatFire]: https://en.greatfire.org/https/supabase.com
[supabase#2631]: https://github.com/supabase/supabase/issues/2631

## Regras para Edge Functions do módulo China

1. **Nunca** chamar `https://ai.gateway.lovable.dev/...` direto do front. Use
   `invokeChat()` (cliente) → Edge Function → `callAIGateway()`.
2. **Sempre** finalizar erro de IA com `aiGatewayErrorResponse(r, cors, pickLang(req))`
   para entregar mensagem em ZH quando o usuário vem de CN ou pede `Accept-Language: zh`.
3. **Modelo padrão**: `google/gemini-3-flash-preview` (já é o default do
   `callAIGateway`). Em caso de 429/402 a chain cai para `flash-lite`.
   Para chats longos do módulo China prefira Gemini sobre `openai/*` —
   menos histórico de instabilidade quando o tráfego é classificado como
   originário de regiões sensíveis pelo provider.
4. **Não** expor `*.supabase.co` no front quando houver alternativa via
   `/api/functions/<name>` (Cloudflare Worker).

## Cloudflare Worker — proxy de Edge Functions

`cloudflare/worker.js` mapeia automaticamente:

```text
GET/POST https://china.bimaster.online/api/functions/<name>?<qs>
       │
       ▼
GET/POST https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/<name>?<qs>
```

- Headers preservados: `Authorization`, `apikey`, `content-type`, `accept-language`.
- Header injetado: `x-client-country` (de `request.cf.country`) — Edge Function
  usa para escolher idioma da mensagem de erro e logar telemetria.
- CORS: `Access-Control-Allow-Origin` reflete o `Origin` da requisição.
- Deploy: `npx wrangler deploy` (mesmo procedimento de
  `mem://infra/cloudflare-worker-deploy`).

## Como testar a partir da China sem VPS lá

- **HTTP probe**: `https://www.itdog.cn/http/<url>` — testa de ~30 nós CN.
- **Ping/curl**: `https://ping.chinaz.com/<host>` — Pequim/Xangai/Cantão/HK.
- **Status histórico**: `https://en.greatfire.org/analyzer`.

Hosts a testar regularmente:
- `china.bimaster.online`
- `china.bimaster.online/api/functions/china-traduzir-texto` (deve voltar 401
  sem auth — confirma que o proxy está vivo)
- `aokkyrgaqjarhlywhjju.supabase.co/functions/v1/health` (baseline; espera-se
  pior do que o Worker proxy).

## Checklist para nova Edge Function IA do módulo China

- [ ] `Deno.serve(secureHandler({ auth: "jwt", rateLimit: N, rateLimitPrefix: "<name>" }, async (req, ctx) => { ... }))`.
- [ ] Body validado com `z.object({...}).strict()`.
- [ ] IA via `callAIGateway({ model: "google/gemini-3-flash-preview", ... })`.
- [ ] Erro de IA via `aiGatewayErrorResponse(r, cors, pickLang(req))`.
- [ ] Front chama através de `invokeChat()` ou `fetch` para
      `${VITE_SUPABASE_URL}/functions/v1/<name>` (ou idealmente, do domínio
      China, `https://china.bimaster.online/api/functions/<name>`).
- [ ] Sem chamadas diretas a `ai.gateway.lovable.dev` no front.
