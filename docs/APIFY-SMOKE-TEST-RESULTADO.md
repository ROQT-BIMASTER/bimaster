# Apify Smoke Test — 2026-05-04

## Resultado: **BLOQUEADO** (não foi possível executar Passos 2–5)

A chamada à edge function retornou **401 "Não autenticado"** logo no Passo 2.
Como as restrições proíbem alterar código/secrets/redeploy e mandam **PARAR e
reportar** ao primeiro erro, o smoke test foi interrompido. Nenhuma chamada
ao Apify foi disparada (cota preservada — **0 de 2** permitidas usadas).

---

## Passo 1 — Baseline (executado)

### `apify_run_log` (5 mais recentes)

| actor_id | status | created_at | items_count |
|---|---|---|---|
| `bulk-enrich:done` | ok | 2026-04-28 23:52:39 UTC | 85 |
| `clockworks/tiktok-scraper` | ok | 2026-04-28 23:52:38 UTC | 1 |
| `apify/instagram-profile-scraper` | ok | 2026-04-28 23:52:35 UTC | 1 |
| `apify/instagram-profile-scraper` | ok | 2026-04-28 23:52:27 UTC | 1 |
| `clockworks/tiktok-scraper` | ok | 2026-04-28 23:52:27 UTC | 1 |

**Mais recente:** `2026-04-28 23:52:39 UTC` (≈ 6 dias atrás). Confirma o
achado da auditoria: zero atividade nos últimos 6 dias. Note também que
**`apify/instagram-hashtag-scraper` não aparece** — consistente com a hipótese
de que a strategy `ig_hashtag` nunca é acionada.

### `discovery_searches` (5 mais recentes — só existem 2 registros)

| query_normalized | platform | status | result_count | created_at |
|---|---|---|---|---|
| `cristiano` | instagram | ok | 1 | 2026-04-28 19:41:28 UTC |
| `fitness` | instagram | ok | **0** | 2026-04-28 19:32:22 UTC |

**Mais recente:** `2026-04-28 19:41:28 UTC`. A entrada anterior de `fitness`
retornou **0 resultados** — exatamente o sintoma reportado pelo usuário. Por
isso o teste foi planejado com `force: true` para bypassar o cache negativo.

---

## Passo 2 — Chamada à edge function

Request enviada via `supabase--curl_edge_functions`:

```
POST /functions/v1/discover-influencers
body: {
  "query": "fitness",
  "platform": "instagram",
  "min_followers": 0,
  "max_followers": 10000000,
  "force": true
}
```

**Resposta:**

- **Status:** `401`
- **Body:** `{"error":"Não autenticado"}`
- **Tempo:** < 100 ms (rejeição imediata)
- **Headers:** N/A (nenhum `x-request-id` retornado)

### Por que 401

Inspecionando `supabase/functions/discover-influencers/index.ts` (linhas
134–154):

```ts
Deno.serve(secureHandler({ auth: "none", rateLimit: 10, ... }, async (req) => {
  // ...
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Não autenticado" }),
      { status: 401, headers: jsonHeaders });
  }
  const userClient = createClient(supabaseUrl, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Token inválido" }),
      { status: 401, headers: jsonHeaders });
  }
  // ...
});
```

A função declara `auth: "none"` no `secureHandler` mas **faz a própria
validação de JWT** internamente, exigindo `Authorization: Bearer <jwt>` de um
usuário real. A mensagem foi **"Não autenticado"** (não "Token inválido"), o
que prova que o header `Authorization` **nem chegou** ao handler — a tool
`supabase--curl_edge_functions` só injeta o JWT da sessão de preview do
usuário se ele estiver logado no Lovable naquele instante, e neste momento
isso não aconteceu.

---

## Passo 3 — Verificação no DB

Não executado (bloqueado pela falha do Passo 2).

## Passo 4 — Logs do edge function

Não executado (bloqueado pela falha do Passo 2).

## Passo 5 — Cache hit

Não executado (bloqueado pela falha do Passo 2).

---

## Diagnóstico

**Não classificável** entre as 5 opções da spec, mas com sinais positivos:

- Função **está deployada** e respondendo (rejeitou em < 100 ms com JSON bem
  formado vindo do próprio handler — não é 404 nem timeout).
- URL `/functions/v1/discover-influencers` **está correta**.
- Baseline confirma a auditoria: 0 atividade Apify há 6 dias e cache negativo
  de `fitness` (`result_count=0`) registrado em 28/04.
- `apify/instagram-hashtag-scraper` não aparece em nenhum run — strategy
  `ig_hashtag` provavelmente nunca dispara.
- **Não foi possível provar** se, com JWT válido, a função encadeia até o
  Apify e retorna dados — esse era justamente o ponto que o smoke test queria
  validar.

### Hipótese reforçada (não comprovada)

Dado que a função exige JWT e a instrumentação aplicada na sessão anterior em
`InfluencerDiscovery.tsx` (fix #1) agora discrimina 401/403, é provável que o
sintoma reportado pelo usuário seja **sessão expirada silenciosa** que o
`catch` antigo engolia, fazendo o spinner virar "vazio" sem feedback.

---

## Próximas ações sugeridas (a discutir, não fazer agora)

1. **Pedir ao usuário** para fazer login no preview do Lovable e reproduzir
   a busca no UI Bi Master com DevTools aberto. A instrumentação aplicada
   vai mostrar:
   - Toast "Sessão expirada" → confirma hipótese auth.
   - Toast "Sem conexão" → confirma hipótese network/CORS.
   - Toast com mensagem específica → mostra erro real do backend.
2. **Repetir este smoke test** depois que o usuário confirmar login ativo no
   preview — assim a tool consegue injetar o JWT e Passos 2–5 rodam de fato.
3. **Não recomendado:** forjar JWT manualmente ou usar service-role —
   violaria a restrição de "não alterar secrets" e mascararia o problema real.

---

## Restrições respeitadas

- Apenas `SELECT` no DB (zero escritas).
- **0 de 2** chamadas ao Apify usadas (cota preservada).
- Nenhum código, secret, `vite.config`, service worker ou `.gitignore`
  alterado.
- Nenhum redeploy de edge function.
- Parado e reportado ao primeiro erro, conforme instruído.
