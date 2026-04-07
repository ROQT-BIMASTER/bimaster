

# Influenciador 360° — Perfil Completo, Análise de Conteúdo e IA de Recomendação

## Resumo

Transformar o módulo de influenciadores em uma plataforma 360° com: foto de perfil real, análise de conteúdo postado, sentimento dos comentários, detecção de seguidores falsos, e IA que recomenda o melhor influenciador para a marca.

## Novas Tabelas (Migration)

### `influencer_posts`
Armazena posts coletados de cada influenciador para análise de conteúdo.
- `id`, `influencer_id` (FK), `user_id`, `platform_post_id`, `post_url`, `post_type` (image/video/reel/story), `caption`, `thumbnail_url`, `likes`, `comments_count`, `shares`, `posted_at`, `ai_content_analysis` (JSONB — temas, tom, qualidade), `created_at`

### `influencer_comments`
Armazena comentários para análise de sentimento.
- `id`, `post_id` (FK), `author_username`, `comment_text`, `sentiment` (positive/negative/neutral), `sentiment_score` (0-1), `is_spam`, `created_at`

### `influencer_analyses`
Relatório 360° gerado pela IA por influenciador.
- `id`, `influencer_id` (FK), `user_id`, `analysis_type` (full_360/sentiment/fraud/content/recommendation), `result` (JSONB), `ai_model`, `created_at`

## Edge Functions

### 1. `analyze-influencer` (Nova)
Função principal que recebe um `influencer_id` e `analysis_type`:

- **profile_photo**: Busca a foto de perfil real via scraping ou API pública da plataforma e atualiza `avatar_url` na tabela `influencers`
- **content_analysis**: Usa IA (Gemini 2.5 Flash) para analisar os posts salvos — identifica temas recorrentes, tom de comunicação, qualidade visual, frequência de posts patrocinados
- **sentiment_analysis**: Analisa comentários dos posts com IA — classifica sentimento (positivo/negativo/neutro), detecta spam e bots
- **fraud_detection**: Analisa padrões de seguidores e engajamento com IA — ratio seguidores/engajamento, crescimento suspeito, qualidade dos comentários, atualiza `fraud_score`
- **full_360**: Executa todas as análises acima e gera um relatório consolidado
- **recommendation**: Recebe contexto da marca (nicho, público-alvo, orçamento) e compara todos os influenciadores monitorados para recomendar os melhores

### 2. `fetch-influencer-content` (Nova)
Coleta posts recentes de um influenciador usando Phyllo API (`get_engagement`) e salva em `influencer_posts`. Se Phyllo não estiver disponível para o perfil, usa IA para estimar baseado em dados públicos.

## Componentes Frontend

### 1. `InfluencerProfile360.tsx` (Nova)
Página/dialog de perfil completo do influenciador com abas:
- **Visão Geral**: Foto real, métricas principais, score de autenticidade, nicho, bio
- **Conteúdo**: Grid de posts recentes com análise de temas e tom
- **Sentimento**: Gráfico de sentimento dos comentários ao longo do tempo, nuvem de palavras
- **Autenticidade**: Score de fraude detalhado, indicadores de seguidores falsos, bandeiras vermelhas
- **Recomendação IA**: Nota de compatibilidade com a marca, prós e contras

### 2. `InfluencerRecommendation.tsx` (Nova)
Painel onde o usuário descreve sua marca/campanha e a IA analisa todos os influenciadores monitorados, ranqueando os melhores com justificativa.

### 3. Atualizações existentes
- **`InfluencerProfileCard.tsx`**: Adicionar foto real (já tem avatar), badge de fraud score mais visível, botão "Analisar 360°"
- **`InfluencerDashboard.tsx`**: Adicionar botão "Recomendar para minha marca", abrir perfil 360° ao clicar no card

## Fluxo do Usuário

```text
1. Usuário descobre influenciador → clica "Monitorar"
2. Sistema coleta posts via Phyllo/IA → salva em influencer_posts
3. Usuário clica "Analisar 360°" no card
4. Edge function analisa: conteúdo, sentimento, fraude
5. Resultado exibido no perfil 360° com abas
6. Usuário clica "Recomendar para minha marca"
7. IA compara todos influenciadores e rankeia os melhores
```

## Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar tabelas `influencer_posts`, `influencer_comments`, `influencer_analyses` |
| `supabase/functions/analyze-influencer/index.ts` | Criar — análises 360° com IA |
| `supabase/functions/fetch-influencer-content/index.ts` | Criar — coleta de posts |
| `src/components/marketing/influencers/InfluencerProfile360.tsx` | Criar — perfil completo |
| `src/components/marketing/influencers/InfluencerRecommendation.tsx` | Criar — recomendação IA |
| `src/components/marketing/influencers/InfluencerProfileCard.tsx` | Modificar — botão 360° |
| `src/components/marketing/influencers/InfluencerDashboard.tsx` | Modificar — navegação e recomendação |

