# Apify Integration Audit — 2026-05-04

> Discovery read-only. Nenhuma alteração de código, secrets, schema ou cache foi
> aplicada. Apenas SELECTs + leitura de arquivos + 2 chamadas de teste live
> (ambas retornaram 401 antes de tocar a lógica de Apify).

## Sumário

| Verificação | Status |
|---|---|
| `APIFY_API_TOKEN` configurado no Edge Functions | **SIM** (presente em `secrets--fetch_secrets`; rotação não exposta) |
| `apify/instagram-hashtag-scraper` rodando últimas 24h | **NÃO** (0 runs em 24h **e** 0 runs em 30d) |
| Qualquer run Apify nas últimas 24h | **NÃO** (0 runs; última execução: `2026-04-28 23:52:39 UTC`, **6 dias atrás**) |
| Cache negativo bloqueando buscas | **NÃO** (0 entradas válidas com `status IN ('empty','timeout')`) |
| Cache `discovery_searches` válido | 1 entrada (`cristiano`, ig, ok, result_count=1) |
| Perfis salvos em `discovered_profiles` | **69** (55 instagram + 14 tiktok), todos `data_source='apify'`, todos com `last_apify_sync_at` em 28-abr |
| Sanidade dos perfis | IG: 44/55 com followers, 30/55 com posts; TT: 13/14 com followers, 11/14 com posts |
| Logs do Edge `apify-influencer-search` (recentes) | Apenas `booted` — **nenhuma invocação recente** |
| Logs do Edge `discover-influencers` (recentes) | **Nenhum log** |
| Teste live (`force:true`) | Não foi possível disparar do sandbox: ambas as funções respondem `401 "Não autenticado"` para chamadas sem JWT do navegador. **Não foi consumida nenhuma cota**. |

## Hipóteses verificadas

### Hipótese 1 — Hashtag scraper falhando silenciosamente
**Status: REFUTADA na forma original — REFORMULADA como "Hashtag scraper nunca foi executado".**

Evidência (Bloco 2):

```
SELECT actor_id, status, COUNT(*) FROM apify_run_log
WHERE created_at > now() - interval '30 days' GROUP BY actor_id, status;
```

| actor_id | status | count |
|---|---|---|
| apify/instagram-profile-scraper | ok | 71 |
| clockworks/tiktok-scraper | ok | 24 |
| bulk-enrich:start | ok | 2 |
| bulk-enrich:done | ok | 2 |

Não existe **nenhum** registro do `apify/instagram-hashtag-scraper` em 30 dias —
nem `ok`, nem `timeout`, nem `error`. Isso significa que o caminho `ig_hashtag`
em `apify-influencer-search/index.ts` (linhas 656–712) **nunca foi acionado**.

Lendo o código (linha 655): `if (!isUsername) { strategies.push({ name: "ig_hashtag", ... }) }`.
A estratégia só é montada quando o termo **não** começa com `@`. Como o termo
chega depois do `.replace(/^[#@]/, "")`, o detector `isUsername =
trimmed.startsWith("@")` continua válido. Conclusão provável: nas últimas
semanas todas as buscas reais foram **handles diretos** (ex.: `cristiano`),
nunca hashtags como `#fitness`. O ator hashtag está **disponível** (token
configurado, código presente), simplesmente nunca foi exercitado pelos usuários.

### Hipótese 2 — Cache negativo travando buscas
**Status: REFUTADA.**

Evidência (Bloco 3.3):

```
cache_validos_total | cache_empty | cache_timeout | ok_zero
        1           |      0      |       0       |    0
```

Há **uma única** entrada de cache válida (`cristiano`, ig, ok, 1 resultado).
Existe outra entrada (`fitness`, ig, ok, 0 resultados) mas já está
**expirada** (TTL restante = `-4 days -17h`), portanto não bloqueia novas
buscas. **Não há cache negativo ativo bloqueando o usuário.**

### Hipótese 3 — Frontend não renderiza resposta
**Status: PROVAVELMENTE IRRELEVANTE — descoberto problema mais cedo na cadeia.**

Trace frontend (Bloco 5):

1. `src/components/marketing/influencers/InfluencerDiscovery.tsx` linha 75
   chama **`discover-influencers`** — **NÃO** `apify-influencer-search`
   diretamente. Body: `{ query, platform, min_followers, max_followers, force }`.
2. Consome resposta em `data?.data || []` (linha 99) e `data?.meta` (linha 100).
3. Filtros UI: `platform`, `min_followers`, `max_followers` — repassados ao
   backend; **não há filtro adicional no client** que mascararia resultados.
4. Logging: usa `logger.error(err)` em catch genérico (linha 105). **Não há
   `console.log` do payload recebido** para diagnóstico no devtools.
5. Estado vazio é tratado com `toast.info(...)` (linha 102); erro de invocação
   vira `toast.error("Erro ao buscar influenciadores")` (linha 106). UI não
   discrimina entre "0 resultados" e "falha de rede/auth".

Cadeia real: **UI → `discover-influencers` → `fetch(apify-influencer-search)` →
Apify**. Se `discover-influencers` não estiver sendo chamado (logs vazios),
o problema está antes do frontend renderizar — está em quem dispara a busca.

### Hipótese 4 — Plano Apify sem permissão
**Status: INCONCLUSIVA, mas evidência indireta sugere REFUTADA.**

Evidência:
- 71 runs `ok` de `apify/instagram-profile-scraper` e 24 `ok` de
  `clockworks/tiktok-scraper` em 30 dias. Nenhum erro registrado em
  `apify_run_log`.
- Token `APIFY_API_TOKEN` está configurado.
- O ator `instagram-hashtag-scraper` é gratuito no Apify Free; uso indica que
  o plano cobre os atores rentáveis. Se o plano fosse o problema, esperaríamos
  ver runs com `status='error'` e mensagem do tipo `"Actor not available on
  current plan"` — não existem.
- **Por que o usuário relata ver `instagram-hashtag-scraper` SUCCEEDED no
  console Apify mas só com 1 result?** Provável que o console Apify mostre
  runs disparadas por **outro caminho** (UI Apify direto, outro projeto, ou
  sync manual fora de banda) e não pelo Edge Function deste sistema. Os runs
  registrados aqui em `apify_run_log` são **só** os disparados pelo Edge
  Function — ele instrumenta toda chamada via `runApifyActor()`.

## Diagnóstico final

**Causa raiz mais provável (confidence: ALTA): a integração Apify está
saudável, mas não está sendo exercitada há ~6 dias.**

Evidências cruzadas:
1. Última execução em `apify_run_log`: 28-abr-2026 23:52 UTC (6 dias atrás).
2. Logs de `apify-influencer-search` mostram apenas `booted` recente — nenhuma
   chamada chegou até o handler.
3. Logs de `discover-influencers` (a função que o UI realmente chama):
   completamente vazios.
4. Cache `discovery_searches`: só 2 entradas históricas, ambas de 28-abr.

Isso indica um destes cenários (em ordem de probabilidade):

**A. (mais provável) O UI está disparando a busca, mas a chamada quebra antes
de chegar à edge function** — provavelmente erro 401 silencioso, falha de
JWT, CORS ou erro de rede no client. O `try/catch` em
`InfluencerDiscovery.tsx:104-109` engole tudo num único toast genérico
"Erro ao buscar influenciadores", então o usuário pode ter visto vazio
sem perceber que era erro. Suporta isso o fato de que **mesmo o sandbox
com curl direto bate em 401** — qualquer chamada sem JWT do navegador é
recusada, então um problema de sessão expirada / token inválido geraria
exatamente o sintoma observado.

**B. (alternativa) O usuário está vendo um cache antigo do PWA / SW** — a
fix recente do Service Worker (v3.4.80) deixou usuários "presos" em
bundles velhos por até uma rodada de update. Um bundle antigo que aponte
para uma rota incorreta, ou que enviasse um body diferente, explicaria a
ausência total de logs.

**C. (menos provável) A UI realmente nunca foi usada nesses 6 dias.** Mas o
usuário descreveu o comportamento como atual, então o cenário A/B é
compatível com "fui tentar agora e veio vazio".

A hipótese inicial do usuário (hashtag scraper falhando silenciosamente,
cache negativo travando) **não é sustentada pelos dados**.

## Próximas ações sugeridas (sem aplicar)

Em ordem de prioridade:

1. **Instrumentar erro real do client** (15 min, baixo risco).
   Em `InfluencerDiscovery.tsx:104`, separar o catch por tipo:
   `error.status === 401` → toast "Sessão expirada, faça login novamente";
   `error.message?.includes('FunctionsFetchError')` → toast com hint de
   network. Logar `JSON.stringify({ data, error })` em DEV antes do `if (error)`.
   Isso revela em segundos se o cenário A é o problema.

2. **Adicionar log estruturado do payload em `discover-influencers`** (10 min).
   Já existe `logger.log("[discover-influencers] apify returned ...")`. Adicionar
   um `logger.log` no início do handler com `{ user_id, query, platform, force }`
   confirma se a função está sequer sendo chamada e com quais args.

3. **Verificar se o usuário relator vê suas próprias chamadas** (5 min).
   Pegar o `user_id` que reportou o bug, rodar:
   ```sql
   SELECT created_at, status, query_normalized, result_count, errors
   FROM discovery_searches
   WHERE user_id = '<uid>'
   ORDER BY created_at DESC LIMIT 20;
   ```
   Se vier vazio → o UI dele não está chegando ao backend (cenário A/B).

4. **Smoke test do hashtag scraper** (30 min). Disparar manualmente uma
   busca por `#fitness` autenticado pela UI ou via `supabase--curl_edge_functions`
   com JWT real. Confirmar se `apify/instagram-hashtag-scraper` aparece no
   `apify_run_log` e quantos items retorna. Resolverá em definitivo se a
   hipótese 4 (plano) tem alguma sombra de fundamento.

5. **Reduzir TTL do cache negativo** (decisão de produto, não bug). O TTL
   atual é 2h para `empty`/`timeout`. Se o usuário ficar frustrado com isso
   no futuro, reduzir para 15-30 min ou expor um botão "Forçar nova busca"
   mais proeminente que o atual ("Atualizar" só aparece **depois** que já
   há resultados — linha 202-206 — exatamente quando NÃO precisa).

6. **Fix UX — botão de force-refresh quando o resultado é zero**
   (`InfluencerDiscovery.tsx:202`). Hoje o botão "Atualizar" só renderiza
   quando `results.length > 0`. Se a busca volta vazia (cache negativo OU
   busca real sem hits), o usuário **não tem como forçar**. Mover o botão
   para ficar sempre visível depois da primeira busca.

7. **Auditar consumo de créditos no console Apify** (manual, fora deste
   sistema). Confirmar se realmente há runs que NÃO aparecem em
   `apify_run_log` — isso indicaria caminho paralelo de consumo (n8n, outro
   ambiente, dev local) e mereceria investigação separada.

## Observações para discussão com humano antes de qualquer fix

- O usuário descreveu sintomas com base em observação do **console Apify**,
  mas a evidência interna mostra que **nem chega-se ao Apify nas últimas
  semanas**. Vale alinhar: ele está vendo runs no console hoje, ou viu há
  alguns dias? Outras pessoas/sistemas usam o mesmo token Apify?
- O fix #1 (instrumentação no client) é o ROI mais alto — sem ele, vamos
  ficar adivinhando entre cenário A e B. **Recomendo aplicar #1 primeiro,
  pedir ao usuário para reproduzir com devtools aberto, e só então decidir
  se há um bug real para corrigir ou se é um problema de sessão/cache PWA.**
