

# Central de Inteligência de Conteúdo — Análise Cross-Influencer + Gerador de Postagens

## Visão Geral

Criar um novo painel **"Inteligência de Conteúdo"** no dashboard de influenciadores que:
1. Analisa todos os posts coletados de todos os influenciadores para identificar **padrões de performance**
2. Gera **sugestões de conteúdo** personalizadas para a empresa com base no que melhor performa
3. Ajuda a **criar postagens prontas** com texto, formato e hashtags otimizadas
4. Recomenda as **melhores hashtags** com base na análise cruzada

## Arquitetura

```text
┌──────────────────────────────────────────────────────────────┐
│               ContentIntelligencePanel                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 1. Performance Insights (top formats, best times,    │    │
│  │    engagement patterns across ALL influencers)        │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 2. Sugestões de Conteúdo (5 ideias baseadas nos      │    │
│  │    padrões + perfil da empresa)                       │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 3. Gerador de Postagem (IA cria texto + hashtags     │    │
│  │    com base em tema/objetivo escolhido pelo user)     │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

## 1. Edge Function `influencer-content-intelligence`

Nova função com 3 ações:

### `analyze_patterns`
- Carrega TODOS os `influencer_posts` do usuário (com métricas: likes, comments, shares, post_type, caption, posted_at)
- Carrega `influencer_company_profile` para contexto
- Envia para IA com prompt que pede:
  - Top 5 tipos de conteúdo que mais performam (reels, carrossel, foto, etc.)
  - Melhores horários/dias para postar
  - Temas recorrentes nos posts de maior engajamento
  - Hashtags mais usadas nos posts de melhor performance
  - Padrões de legenda (tamanho, tom, CTA)
- Retorna JSON estruturado via tool calling

### `suggest_content`
- Recebe os patterns + perfil da empresa
- Gera 5 sugestões de conteúdo para a empresa, cada uma com: título, formato, plataforma, descrição, justificativa (baseada em dados dos influencers), hashtags sugeridas

### `generate_post`
- Recebe: tema, objetivo (engajamento/vendas/awareness), plataforma, tom
- Usa os patterns analisados + perfil da empresa
- Gera: texto da postagem completo, 3 variações de legenda, lista de hashtags rankeadas por relevância, melhor horário sugerido, formato recomendado

## 2. Componente `ContentIntelligencePanel.tsx`

Painel com 3 seções em tabs:

### Tab "Análise de Performance"
- Botão "Analisar Conteúdo" que chama `analyze_patterns`
- Exibe cards com: Top formatos, melhores horários, temas em alta, hashtags mais efetivas
- Mini gráfico de distribuição de engajamento por tipo de post

### Tab "Sugestões para sua Marca"
- Lista de 5 sugestões geradas pela IA
- Cada sugestão com badge de formato, plataforma e botão "Criar Postagem" que preenche o gerador

### Tab "Criar Postagem"
- Formulário: tema/assunto, objetivo (select), plataforma (select), tom (select)
- Botão "Gerar com IA"
- Resultado: texto da postagem com botão copiar, variações de legenda, hashtags com toggle para selecionar, horário recomendado
- Botão "Copiar Tudo" para clipboard

## 3. Integração no Dashboard

- Adicionar nova tab "Inteligência de Conteúdo" no `InfluencerDashboard` ou como card expandível abaixo do painel de oportunidades

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/influencer-content-intelligence/index.ts` | Criar — Edge Function com 3 ações (patterns, suggest, generate) |
| `src/components/marketing/influencers/ContentIntelligencePanel.tsx` | Criar — UI com 3 tabs (análise, sugestões, gerador) |
| `src/components/marketing/influencers/InfluencerDashboard.tsx` | Modificar — Integrar o novo painel |

