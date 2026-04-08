

# Carregar Fotos Reais de Posts do Instagram e Redes Sociais

## Situação Legal e Técnica

**Sim, é permitido por lei** acessar fotos públicas de redes sociais, desde que feito da forma correta:

1. **Via APIs oficiais** (Instagram Graph API, TikTok API, YouTube Data API) — esta é a forma legal e recomendada. As plataformas disponibilizam endpoints de conteúdo público para desenvolvedores autorizados.

2. **Via agregadores autorizados como Phyllo** — o sistema já usa o Phyllo, que é um intermediário licenciado que acessa as APIs oficiais. Quando o Phyllo retorna dados, o campo `media_url` e `thumbnail_url` contém as URLs reais das fotos.

3. **O que NÃO é permitido**: scraping direto (violar Terms of Service), redistribuição comercial das fotos sem autorização, ou armazenar permanentemente mídia protegida por direitos autorais.

## Diagnóstico do Problema Atual

O sistema já coleta `thumbnail_url` e `media_url` via Phyllo (linha 110 do `fetch-influencer-content`), mas:

- **URLs do Instagram/Meta expiram** — as CDN URLs (`scontent.cdninstagram.com`) têm tokens temporários que expiram em ~1h
- **Quando o fallback IA gera conteúdo**, usa `picsum.photos` que não tem relação com o post real
- **Não há renovação de URLs** — uma vez salva no banco, a URL expira e a foto para de carregar

## Solução Proposta

### 1. Edge Function — Resolver mídia em tempo real

Criar `resolve-post-media` que, ao abrir um post, busca a URL atualizada via Phyllo API em tempo real (usando o `platform_post_id` salvo), em vez de confiar na URL cached no banco.

### 2. Armazenamento de mídia persistente (opcional)

Para posts importantes, fazer download da mídia via Edge Function e salvar no Storage do Lovable Cloud (bucket privado), gerando URLs estáveis com signed URLs.

### 3. Frontend — Resolver mídia sob demanda

No `PostDetailDialog`, ao abrir um post:
- Se `thumbnail_url` falhar (erro de carregamento), chamar a Edge Function para obter URL fresca
- Exibir spinner enquanto resolve
- Cachear resultado na sessão

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/resolve-post-media/index.ts` | Criar — busca URL atualizada via Phyllo por `platform_post_id` |
| `src/components/marketing/influencers/PostDetailDialog.tsx` | Modificar — resolver mídia on-demand quando URL falha |
| `src/components/marketing/influencers/InfluencerProfile360.tsx` | Modificar — resolver thumbnails no grid quando falham |

