
## Diagnóstico — por que a entrada de dados está falhando

Análise do screenshot Apify + logs da função + tabela `discovery_searches`:

| # | Sintoma | Causa raiz |
|---|---|---|
| 1 | `apify/instagram-scraper` e `apify/instagram-hashtag-scraper` **TIMED-OUT em 1m30s** (screenshot) | Chamamos via `run-sync-get-dataset-items` com `timeout=90s`, mas o Apify continua o run em background até 1m30s. Quando estoura, retornamos 502 → **a busca toda falha** e o usuário vê "0 resultados" mesmo quando o `instagram-profile-scraper` já tinha trazido perfis úteis. |
| 2 | Cada falha **consome execução paga no Apify** sem persistir nada | Não há cache negativo. Mesma query repetida dispara nova execução. Vide `discovery_searches` com `result_count=0` para "fitness" — a próxima busca por "fitness" vai ignorar esse registro (cache só lê quando há `result_usernames` com itens) e disparar Apify de novo. |
| 3 | Resultados parciais são descartados | Quando `instagram-hashtag-scraper` falha mas `instagram-profile-scraper` (perfil direto) tem sucesso, o `try/catch` envolve tudo num bloco só → resultado do perfil direto é perdido. |
| 4 | Termos livres ("fitness", "skincare") sempre falham | Roteamos termo livre como hashtag (`#fitness` no hashtag-scraper), que é o actor mais lento. Para termo livre deveríamos usar diretamente o **profile-scraper com o termo como username** + um actor de busca textual mais leve. |
| 5 | Sem retry / sem timeout adaptativo | Um único timeout estourado = busca inteira perdida. Não tentamos novamente o profile-scraper (que é rápido — 3-8s no screenshot) com termos derivados. |
| 6 | Cache de busca não persiste **falhas/timeouts** nem **buscas com 0 resultados úteis** | Resultado: usuário insiste, gastamos mais Apify, mesma falha. |

---

## Plano de correção (sem mexer em UI)

### 1. Quebrar a busca em **etapas isoladas e tolerantes a falhas** (`apify-influencer-search/index.ts`)

Refatorar o bloco Instagram para que cada estratégia rode independente e qualquer sucesso parcial seja preservado:

```text
buscar(query):
  estratégias = []
  if @username  → [profile-scraper(term)]
  if #hashtag   → [profile-scraper(term),         // perfil de mesmo nome — RÁPIDO, primeiro
                   hashtag-scraper(term, light)]  // só se profile não devolver suficiente
  if termo livre→ [profile-scraper(termo),        // tenta como handle direto
                   profile-scraper(termo sem espaço)]
                   // hashtag-scraper só como tentativa final, com timeout curto

  para cada estratégia, com Promise.allSettled e timeout INDIVIDUAL:
    se sucesso → acumula no results[]
    se timeout/erro → registra em errors[], continua

  retorna results parciais (mesmo que 1 estratégia tenha falhado)
```

Trocar `runApifyActor` para:
- usar `timeout=60` (não 90) no profile-scraper (ele costuma terminar em <10s);
- para hashtag-scraper: `timeout=45` + `resultsLimit` reduzido (5 ao invés de `limitNum*2`);
- adicionar **1 retry** com backoff só para erros transitórios (5xx / network), nunca em TIMED-OUT (que é caro).

### 2. **Cache negativo** para evitar reconsumo de Apify

Quando Apify devolve 0 resultados ou todos os actors estouram timeout:
- Persistir `discovery_searches` com `result_usernames=[]`, `result_count=0`, **TTL curto (2h)**, e novo campo `status='empty' | 'timeout'`.
- Ajustar `readSearchCache` para também devolver "miss controlado" quando há cache `status='empty'` válido → retorna array vazio sem chamar Apify, e o `discover-influencers` cai direto no fallback IA (Gemini/GPT) sem disparar `apify-influencer-search` de novo.

Migration:
```sql
ALTER TABLE discovery_searches
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS errors jsonb;
-- TTL diferenciado: 2h para empty/timeout, 24h para ok
```

### 3. **Cache hit também por sub-termos / username direto**

Antes de chamar Apify:
- Se a query é `@user` ou `#user`, checar `discovered_profiles` por aquele `username` (qualquer plataforma) — se existir e válido, devolve direto sem disparar nada.
- Para termo livre: além do `query_normalized` exato, tentar match prefixo nos últimos 7 dias (`query_normalized LIKE term%`).

### 4. **Persistência idempotente e em lote** ao gravar resultados

O loop `for (const r of results) await upsertProfileCache(...)` faz N round-trips. Trocar por **um único `upsert` em batch** com `onConflict: 'platform,username'` — mais rápido e atômico (segue o pattern lovable-stack-overflow já documentado).

### 5. **Timeout do front coerente com o back**

Atualmente o front aguarda o `discover-influencers` que, no pior caso, espera Apify (90s) + Gemini + GPT. Garantir que `apify-influencer-search` **devolve em ≤30s** mesmo com timeouts internos:
- usar `Promise.race` com um budget global de 25s; o que não chegou até lá vira "estratégia abortada" → resposta com o que tiver e `meta.partial=true`.

### 6. **Logs estruturados de consumo Apify** (debug futuro)

Em cada run, gravar uma linha em uma tabela `apify_run_log` (nova) com:
`actor_id, input_summary, status, duration_ms, items_count, error, user_id, created_at`.

Permite auditar consumo, ver quais actors mais falham e ajustar timeouts. Sem UI ainda — só dados para inspeção via SQL.

Migration:
```sql
CREATE TABLE apify_run_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  actor_id text not null,
  input_summary jsonb,
  status text not null, -- 'ok' | 'timeout' | 'error'
  duration_ms int,
  items_count int default 0,
  error text,
  created_at timestamptz default now()
);
ALTER TABLE apify_run_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads run log" ON apify_run_log FOR SELECT USING (has_role(auth.uid(),'admin'));
```

### 7. Ajuste pequeno em `discover-influencers`

Se `apify-influencer-search` devolver `meta.status='empty'` ou `meta.partial=true` com 0 itens, **pular** a chamada Apify nas próximas N horas (já garantido pelo cache negativo da etapa 2) e ir direto para Gemini grounded.

---

## Arquivos afetados

**Edge functions**
- `supabase/functions/apify-influencer-search/index.ts` — refatoração principal (estratégias paralelas, cache negativo, timeout budget, batch upsert, log de run).
- `supabase/functions/discover-influencers/index.ts` — respeitar `meta.status` do apify e não re-chamar quando há cache negativo válido.

**Migrations (SQL)**
- nova migration para colunas `status`/`errors` em `discovery_searches` e tabela `apify_run_log`.

**Frontend**
- **Nenhum**. Toda a correção é backend/dados. UI continua igual; ela já trata `meta.cached` e `data:[]`.

---

## Resultado esperado

- Nenhuma chamada nova ao Apify para query que falhou nas últimas 2h.
- Resultados parciais sempre aproveitados (perfil direto + hashtag).
- Tempo de resposta do `apify-influencer-search` cap em ~25s.
- Auditoria de consumo Apify disponível via `select * from apify_run_log`.

Posso seguir com a implementação?
