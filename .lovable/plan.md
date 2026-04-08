

# Seção de Comentários com Top 10 Positivos e Negativos

## Objetivo

Adicionar uma seção dedicada a comentários dentro da aba Conteúdo do Perfil 360°. Exibe os Top 10 comentários positivos e Top 10 negativos, com análise de sentimento por IA para comentários ainda sem classificação.

## Abordagem

### 1. Componente `CommentsHighlightsSection`

Novo componente que:
- Carrega todos os comentários do influenciador (via `influencer_comments` JOIN `influencer_posts`)
- Separa em duas listas: Top 10 positivos (maior `sentiment_score`) e Top 10 negativos (menor `sentiment_score`)
- Exibe com cards visuais, badge de sentimento, nome do autor e trecho do post
- Botão "Analisar Sentimento" para comentários sem classificação

### 2. Edge Function `analyze-comments-sentiment`

- Recebe `influencer_id`
- Busca comentários sem `sentiment` preenchido
- Envia em lotes para Lovable AI (Gemini Flash) com tool calling para extrair sentimento estruturado
- Atualiza cada comentário no banco com `sentiment` e `sentiment_score`

### 3. Integração na ContentTab

- Adicionar o `CommentsHighlightsSection` abaixo da galeria de posts na aba Conteúdo
- Passa o `influencer_id` para o componente carregar seus dados

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/marketing/influencers/CommentsHighlightsSection.tsx` | Criar — seção com Top 10 positivos/negativos |
| `supabase/functions/analyze-comments-sentiment/index.ts` | Criar — análise de sentimento em lote via IA |
| `src/components/marketing/influencers/InfluencerProfile360.tsx` | Modificar — adicionar CommentsHighlightsSection na ContentTab |

