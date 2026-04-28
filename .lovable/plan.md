## Objetivo

Tornar o módulo de influenciadores cumulativo: toda pesquisa feita via Apify (descoberta, enrich, sync) passa a alimentar um cache persistente no banco. Próximas buscas pelo mesmo termo/handle retornam instantaneamente do cache (sem custo Apify), e imagens (avatar + thumbnails de posts) só são baixadas para o nosso Storage quando o usuário pedir explicitamente para "carregar mídia".

## Arquitetura proposta

```text
Discovery / Enrich / Sync
        │
        ▼
 apify-influencer-search ──► (1) consulta cache no banco
        │                       └─► HIT  → devolve dados salvos
        │                       └─► MISS → chama Apify, salva, devolve
        ▼
   Tabelas de cache:
   • discovered_profiles      (perfis vindos de qualquer busca)
   • discovery_searches       (histórico de queries: termo → resultados)
   • influencer_posts         (já existe – ganha campos de cache de mídia)

Mídias (avatar / thumbnail / vídeo)
   • Por padrão: ficam apenas as URLs originais da Apify (sem download)
   • Botão "Carregar mídia" → edge function ingest-influencer-media
       baixa o arquivo, sobe para bucket "influencer-media" (privado),
       grava o storage_path nas colunas *_storage_path
   • UI usa signed URL quando *_storage_path existe; senão usa URL original
```

## Mudanças no banco (migração)

Nova tabela `discovered_profiles` (cache global de perfis Apify):
- `id`, `platform`, `username` (unique por platform+username)
- todos os campos enriquecidos (display_name, bio, followers, verified, etc.)
- `avatar_url` (origem Apify) + `avatar_storage_path` (após ingest)
- `raw_payload jsonb` (resposta crua da Apify)
- `last_apify_sync_at`, `expires_at` (TTL configurável, default 7 dias)
- `data_source = 'apify'`
- RLS: leitura para autenticados; escrita só via service role (edge function)

Nova tabela `discovery_searches` (histórico/cache de buscas):
- `id`, `user_id`, `query_normalized`, `platform`, `min_followers`, `max_followers`
- `result_usernames text[]` (chaves para `discovered_profiles`)
- `created_at`, `expires_at` (default 24h)
- RLS: cada usuário vê seus próprios; service role escreve

Alterações em `influencer_posts`:
- `thumbnail_storage_path text`
- `media_storage_path text`
- `media_ingested_at timestamptz`

Bucket novo `influencer-media` (privado) com policies:
- SELECT para autenticados
- INSERT/UPDATE/DELETE só via service role

## Mudanças nas edge functions

**`apify-influencer-search`** — passa a:
1. Normalizar a query (lowercase, sem #, etc.) e procurar em `discovery_searches` não expirado → se HIT, lê os perfis em `discovered_profiles` e devolve.
2. Em MISS, chama Apify normalmente, depois faz upsert em `discovered_profiles` (com `raw_payload`) e cria registro em `discovery_searches`.
3. Em `action: "enrich"`, faz upsert no cache antes de devolver. Se já existe registro fresco (TTL), devolve do cache sem chamar Apify (parâmetro `force=true` para bypass).

**`apify-sync-influencer`** — também atualiza `discovered_profiles` em paralelo ao update de `influencers`, mantendo cache global coerente.

**Nova `ingest-influencer-media`** — recebe `{ kind: "avatar"|"post", id }`:
- Para avatar: baixa `avatar_url` do `discovered_profiles` ou `influencers`, faz upload para `influencer-media/avatars/{platform}/{username}.jpg`, grava `avatar_storage_path`.
- Para post: baixa `thumbnail_url` (e `media_url` se imagem) do `influencer_posts`, salva em `posts/{influencer_id}/{post_id}.jpg`, grava paths.
- Limites: tamanho máx 20MB, valida content-type, idempotente (não re-baixa se já tem path).

## Mudanças no frontend

**`InfluencerDiscovery`**:
- Indicador "Resultado em cache (desde X)" quando vier de `discovery_searches`.
- Botão "Forçar busca nova" passa `force: true`.

**`InfluencerProfileCard` / `InfluencerProfile360`** (aba conteúdo):
- Avatar e thumbnails: se houver `*_storage_path`, busca via signed URL (reutiliza `useResolvedAvatarUrl` adaptado); senão mostra a URL original Apify.
- Adicionar botão **"Carregar mídia"** por post (e um global "Carregar todas") que chama `ingest-influencer-media`. Após sucesso, invalida query e a imagem passa a vir do nosso bucket.
- Avatar do perfil: botão pequeno "Salvar foto" no card 360 que dispara o ingest do avatar.

**Hook novo `useIngestMedia`**: wrapper sobre a edge function com toast e invalidate.

## Fora de escopo (desta etapa)

- Não baixa vídeos automaticamente (só se o usuário clicar; vídeo grande = só registra `media_storage_path` se for imagem ou se o usuário marcar opção "incluir vídeos").
- Não cria job em background para ingest em massa — apenas sob demanda do usuário.
- Demografia/audiência (Phyllo) continua igual.

## Arquivos afetados

- novo: `supabase/migrations/<timestamp>_discovery_cache_and_media.sql`
- novo: `supabase/functions/ingest-influencer-media/index.ts`
- editar: `supabase/functions/apify-influencer-search/index.ts`
- editar: `supabase/functions/apify-sync-influencer/index.ts`
- novo: `src/hooks/useIngestMedia.ts`
- editar: `src/components/marketing/influencers/InfluencerDiscovery.tsx`
- editar: `src/components/marketing/influencers/InfluencerProfile360.tsx`
- editar: `src/components/marketing/influencers/InfluencerProfileCard.tsx`

## Validação

- Buscar `#fitness` duas vezes seguidas → segunda chamada retorna `cache_hit: true` e não consome Apify.
- Clicar "Carregar mídia" num post → arquivo aparece em `influencer-media/posts/...`, próximo render usa signed URL.
- TTL: após `expires_at`, nova busca refaz hit Apify e atualiza cache.
