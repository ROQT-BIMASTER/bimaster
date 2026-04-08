

# Persistir Mídia Real dos Posts no Storage

## Diagnóstico

Os 188 posts no banco têm `thumbnail_url` com URLs falsas ou expiradas:
- `instagram.fspo.com` (domínio fictício gerado pela IA)
- `picsum.photos`, `placehold.co`, `example.com` (placeholders)
- URLs reais do Instagram/TikTok CDN que já expiraram

Nenhuma dessas URLs funciona, por isso todos os cards mostram o placeholder SVG "do post".

## Solução

Quando o Phyllo retorna conteúdo real com `media_url` ou `thumbnail_url`, fazer download imediato da imagem/vídeo e salvar no Supabase Storage (bucket `post-media`). Gravar o path no banco em vez da URL temporária. No frontend, gerar signed URLs para exibição.

Para posts gerados por IA (sem Phyllo), manter a geração de thumbnails via picsum.photos — que funciona e carrega normalmente.

## Etapas

### 1. Criar bucket `post-media` (migração)
Bucket público para simplificar (thumbnails de posts públicos). Alternativa: bucket privado com signed URLs.

### 2. Modificar `fetch-influencer-content` Edge Function
Após receber conteúdo do Phyllo, para cada item com `media_url` ou `thumbnail_url`:
- Fazer `fetch` da URL da mídia
- Upload do blob para `post-media/{influencer_id}/{post_id}.jpg`
- Gravar o path do Storage como `thumbnail_url` no banco

### 3. Modificar `resolve-post-media` Edge Function
Quando chamada para um post sem thumbnail funcional:
- Tentar buscar mídia fresca do Phyllo
- Fazer download e upload para Storage
- Retornar a URL pública do Storage

### 4. Atualizar frontend para usar URLs do Storage
No `getPostMediaSource`, detectar se a URL é do Supabase Storage (funciona permanente) vs. externa (pode expirar). Gerar URL pública do Storage quando aplicável.

### 5. Corrigir fallback IA
Garantir que `picsum.photos` URLs continuam funcionando para posts estimados pela IA (já funcionam — o problema são só as URLs fake como `instagram.fspo.com`).

## Arquivos

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar bucket `post-media` via Storage |
| `supabase/functions/fetch-influencer-content/index.ts` | Modificar — download + upload de mídia ao Storage |
| `supabase/functions/resolve-post-media/index.ts` | Modificar — persistir mídia resolvida no Storage |
| `src/lib/utils/post-media.ts` | Modificar — reconhecer URLs do Storage como permanentes |
| `src/components/marketing/influencers/InfluencerProfile360.tsx` | Ajuste menor — usar URL pública do Storage |

