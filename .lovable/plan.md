

# Detalhes de Post com Fotos e Comentários

## Situação Atual

A aba Conteúdo mostra cards simples com legenda, métricas e link. Não exibe thumbnail/foto do post nem comentários. A tabela `influencer_posts` tem `thumbnail_url` (atualmente null) e `post_url`. A tabela `influencer_comments` já existe com `author_username`, `comment_text`, `sentiment`, `sentiment_score` e `is_spam`.

## Solução

### 1. Edge Function `fetch-influencer-content` — Coletar thumbnails

Modificar o prompt da IA para gerar `thumbnail_url` plausíveis (usando picsum.photos ou placeholder) para cada post, garantindo que o campo seja preenchido. Quando a fonte for API real (Phyllo), o thumbnail já virá preenchido.

### 2. Componente `PostDetailDialog.tsx` (novo)

Dialog que abre ao clicar em um post, exibindo:
- **Imagem/Thumbnail** do post (com fallback para placeholder baseado no tipo)
- **Legenda completa** (sem truncar)
- **Métricas** (likes, comments, shares) em destaque
- **Link externo** para o post original
- **Comentários** carregados do banco (`influencer_comments` filtrado por `post_id`):
  - Username, texto, badge de sentimento (positivo/negativo/neutro), flag de spam
  - Ordenados por data
  - Contagem de comentários por sentimento

### 3. ContentTab — Adicionar thumbnails e clique

Modificar `ContentTab` no `InfluencerProfile360.tsx`:
- Exibir `thumbnail_url` como imagem no card (com fallback para ícone do tipo de post)
- Ao clicar no card, abrir `PostDetailDialog` com os detalhes e comentários
- Layout em grid visual (estilo Instagram) quando há thumbnails

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/marketing/influencers/PostDetailDialog.tsx` | Criar — Dialog com foto, legenda completa e comentários |
| `src/components/marketing/influencers/InfluencerProfile360.tsx` | Modificar — ContentTab com thumbnails e clique para abrir detalhes |
| `supabase/functions/fetch-influencer-content/index.ts` | Modificar — Incluir thumbnail_url no prompt de geração IA |

