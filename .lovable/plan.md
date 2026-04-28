## Diagnóstico

Hoje a Apify só é usada em **um único ponto** — o diálogo `InfluencerDiscovery` (botão "Descobrir com IA"). Todo o resto do módulo continua dependente de:

- **Phyllo** (`fetch-influencer-content`, `phyllo-proxy`) → coleta de posts, audiência, receita
- **IA generativa** (`influencer-autopilot/refresh_all_data`) → atualiza seguidores, ER, etc. com dados que o modelo "acha" que sabe
- **Campos vazios na UI** → bio, verificação, categoria, posts recentes, mídia real do perfil não são exibidos mesmo quando a Apify já retorna isso na descoberta

Resultado: o usuário descobre um perfil com bio + verified + 29M seguidores REAIS, salva, e ao abrir o card na home vê dados zerados ou desatualizados, porque a Apify não é chamada de novo.

## O que a Apify oferece (e ainda não usamos)

| Dado Apify | Front hoje | Onde usar |
|---|---|---|
| `biography` | ❌ | Card + Profile360 header |
| `verified` (selo azul) | ❌ no card | Badge em todos os lugares |
| `businessCategoryName` | ❌ | Filtro de nicho automático |
| `profilePicUrlHD` (HD) | parcial | Avatar grande no Profile360 |
| `latestPosts[]` (12 últimos) | ❌ | Aba "Conteúdo" sem precisar Phyllo |
| `relatedProfiles[]` | ❌ | Sugestão "Influenciadores semelhantes" |
| `externalUrl` (link bio) | ❌ | Link no card |
| `joinedRecently` / `private` | ❌ | Sinal de risco |
| `igtvVideoCount`, `highlightReelCount` | ❌ | KPIs adicionais |
| TikTok: `heart`, `videoCount`, `diggCount` | parcial | KPIs TikTok |
| TikTok: `signature` (bio) | ❌ no card | Bio TikTok |

## Estratégia em 3 frentes

### Frente 1 — Promover Apify a fonte primária no banco
Estender `influencers` para guardar tudo que Apify retorna, e criar um caminho único de "refresh" que chama Apify em vez de IA.

### Frente 2 — UI mais rica em todo o módulo
Mostrar os campos novos em **todos** os pontos onde o influenciador aparece (não só na descoberta).

### Frente 3 — Ações de enriquecimento
Botão único "Atualizar via fonte oficial" no card e no Profile360, que chama Apify e atualiza tudo de uma vez (substitui o atual "Atualizar Dados (IA)" que adivinha).

---

## Plano de implementação

### 1. Backend — expandir Apify edge function

Arquivo: `supabase/functions/apify-influencer-search/index.ts`

- Acrescentar à interface `NormalizedInfluencer`: `external_url`, `business_category`, `posts_count`, `following_count`, `private`, `latest_posts[]` (até 12, com `url`, `caption`, `likes`, `comments`, `thumbnail`, `posted_at`, `type`).
- Trocar o uso do actor `apify/instagram-scraper` (mais lento, falha) pelo `apify/instagram-profile-scraper` em modo `resultsLimit: 12` para perfis individuais — ele já devolve os 12 últimos posts juntos.
- Para hashtag, em vez do flow `posts → enrich`, usar o actor `apify/instagram-hashtag-scraper` com `resultsLimit: limitNum` e enriquecer só os 5 top em paralelo (Promise.all com timeout individual de 60s).
- Adicionar novo `action` no body: `action: "enrich"` recebe `username` + `platform`, devolve perfil completo + posts. Será chamado pelo botão "Atualizar via fonte oficial".

### 2. Backend — nova edge function de sync persistente

Arquivo novo: `supabase/functions/apify-sync-influencer/index.ts`

- Recebe `influencer_id`.
- Chama `apify-influencer-search` no modo `enrich`.
- Faz `update` em `influencers` (followers, ER, avg_likes, avg_comments, bio, verified, category, avatar HD).
- Faz `upsert` em `influencer_posts` para os últimos 12 posts (chave: `platform_post_id`).
- Baixa o avatar HD para o bucket `post-media` se ainda não estiver lá (evita expirar URL Instagram).
- Atualiza `last_synced_at`.
- Retorna resumo: `{ updated_fields, new_posts, updated_posts }`.

### 3. Banco — adicionar colunas faltantes

Migration:
```text
ALTER TABLE influencers ADD COLUMN bio text;
ALTER TABLE influencers ADD COLUMN is_verified boolean DEFAULT false;
ALTER TABLE influencers ADD COLUMN business_category text;
ALTER TABLE influencers ADD COLUMN external_url text;
ALTER TABLE influencers ADD COLUMN posts_count integer;
ALTER TABLE influencers ADD COLUMN following_count integer;
ALTER TABLE influencers ADD COLUMN is_private boolean DEFAULT false;
ALTER TABLE influencers ADD COLUMN data_source text DEFAULT 'manual';
ALTER TABLE influencer_posts ADD COLUMN media_url text;  -- URL original
ALTER TABLE influencer_posts ADD COLUMN source text DEFAULT 'phyllo';
```
Sem mudança em RLS.

### 4. Frontend — `InfluencerProfileCard.tsx`
- Adicionar selo verificado ao lado do nome (ícone CheckCircle azul) quando `is_verified`.
- Mostrar 1 linha de bio truncada (`line-clamp-1`) abaixo do username.
- Badge da categoria de negócio (`business_category`) substituindo/complementando `nicho` quando disponível.
- Ícone "globe" + link para `external_url` quando existir.
- Ícone discreto de "fonte" (Apify = ✓ verde "Dados verificados", IA = ⚠️ amarelo "Estimado") usando `data_source`.

### 5. Frontend — `InfluencerDiscovery.tsx`
- Mostrar bio truncada no card de resultado.
- Selo verificado se `is_verified`.
- Categoria/business como badge.
- Ao clicar "Monitorar", salvar TODOS os campos novos (bio, verified, category, external_url, etc.) no insert.
- Adicionar 3 chips de exemplo de **plataforma**: ao clicar em "TikTok @charlidamelio" preenche e seleciona.
- Mostrar contagem de posts recentes encontrados ("12 posts recentes coletados") quando vier.

### 6. Frontend — `InfluencerProfile360.tsx`
- Header: bio completa abaixo do username, badge verificado, link externo.
- Aba "Visão Geral": novo card com `posts_count`, `following_count`, `business_category`.
- Aba "Conteúdo": se `posts.length === 0` E `data_source === 'apify'`, mostrar botão **"Carregar últimos 12 posts (Apify)"** em vez do atual "Coletar Conteúdo" que vai pro Phyllo.
- Trocar botão "Atualizar Dados (IA)" do dashboard por **"Atualizar via fonte oficial"** que chama `apify-sync-influencer` em batch.
- Mostrar timestamp `last_synced_at` e qual foi a fonte da última atualização.

### 7. Frontend — `InfluencerDashboard.tsx`
- Substituir a ação "Atualizar Dados (IA)" pelo novo "Atualizar via Apify" (com tooltip explicando: "Busca dados ao vivo do Instagram/TikTok via fonte verificada").
- Manter "Recalcular" (score local, não precisa de Apify).
- Adicionar KPI extra: contagem de "Perfis verificados" (selo azul).
- Filtro novo no header: toggle "Só verificados".

### 8. Frontend — `AddInfluencerDialog.tsx`
- Após o usuário digitar `@username`, fazer **lookup automático no Apify** (debounce 800ms) e pré-preencher: display_name, avatar, followers, bio, verified.
- Mostrar preview do perfil antes de salvar.
- Eliminar a necessidade do usuário digitar manualmente seguidores/ER.

### 9. Substituir Phyllo onde Apify cobre
- `fetch-influencer-content`: adicionar Apify como **fonte primária** (mantém Phyllo como fallback). Hoje é o inverso.
- `phyllo-proxy → search_creators` continua só pra audiência demográfica (que Apify não dá).

---

## Detalhes técnicos

**Performance hashtag IG:** o actor `instagram-profile-scraper` já devolve os 12 últimos posts no MESMO request — então pegar 5 perfis enriquecidos custa 5 requests em paralelo (~15s total) em vez do duplo-actor atual (60-120s).

**Cache:** salvar resultado de `enrich` por 6h no `influencers.last_synced_at` para evitar re-chamadas. Botão "Atualizar" ignora cache.

**Custo Apify:** cada profile-scrape custa ~$0.0023 USD. Sync em massa de 100 influenciadores = $0.23. Bem mais barato que IA generativa.

**Fallback:** se Apify falhar (token inválido / rate limit), o `apify-sync-influencer` retorna `{ ok: false, fallback_to_ai: true }` e a UI ainda pode chamar o autopilot atual.

**Breaking changes:** zero. Todos os novos campos são nullable. UI lê com `??` defaults.

---

## Versionamento

- Bump `APP_VERSION` para `3.4.38`.
- Entrada no changelog `ApiDocumentation.tsx`: "Apify promovido a fonte primária; novos campos (bio, verified, categoria, link externo, posts) em todo o módulo de influenciadores."
- Memória `mem://features/marketing/influencer-intelligence-and-ranking` será atualizada para refletir Apify como fonte oficial.

---

## Pergunta antes de começar

Quer que eu **substitua** o Phyllo (que custa subscription mensal e raramente retorna dados pra perfis BR) pela Apify em todos os fluxos onde for possível, ou prefere manter Phyllo + Apify rodando em paralelo (Apify primeiro, Phyllo fallback)?

Recomendação: **manter os dois**, Apify primário, Phyllo só pra demografia de audiência (idade/gênero/cidade) que Apify de fato não tem.