

# Inteligência 360° Turbinada — Notícias, Riscos e Reputação em Tempo Real

## O que muda

A análise 360° atual usa apenas dados internos (posts salvos e comentários). A proposta é criar um sistema de **Inteligência de Reputação** que busca dados externos da web para enriquecer radicalmente o perfil, adicionando uma nova aba **"Reputação & Riscos"** com funcionalidades surpreendentes.

## Arquitetura

```text
┌─────────────────────────────────────────────────┐
│          InfluencerProfile360.tsx                │
│  Nova aba: "Reputação"                          │
│  ┌──────────────────────────────────────┐       │
│  │ 🔴 Nível de Risco Reputacional      │       │
│  │ 📰 Timeline de Notícias (live)      │       │
│  │ ⚠️  Polêmicas & Controvérsias       │       │
│  │ 📊 Sentimento da Mídia              │       │
│  │ 🏆 Brand Safety Score               │       │
│  │ 💡 Recomendação Estratégica         │       │
│  └──────────────────────────────────────┘       │
└──────────────┬──────────────────────────────────┘
               │ supabase.functions.invoke
               ▼
┌─────────────────────────────────────────────────┐
│   Edge Function: research-influencer-reputation │
│                                                 │
│   1. Lovable AI (Gemini 2.5 Pro) com Web Search │
│      → Pesquisa na web por notícias, polêmicas  │
│      → Análise de sentimento de cada resultado  │
│      → Brand Safety scoring                     │
│      → Detecção de crises e timeline            │
│                                                 │
│   2. Retorna JSON estruturado com:              │
│      - news_timeline (notícias com sentimento)  │
│      - controversies (polêmicas detectadas)     │
│      - reputation_score (0-100)                 │
│      - brand_safety_level                       │
│      - media_sentiment_distribution             │
│      - crisis_alerts (alertas ativos)           │
│      - strategic_recommendation                 │
└─────────────────────────────────────────────────┘
```

## O que é surpreendente

1. **Crisis Detection System** — A IA classifica automaticamente polêmicas por gravidade (low/medium/high/critical) e mostra um indicador visual tipo semáforo. Se há uma crise ativa, o card do influenciador no grid principal também ganha um badge de alerta vermelho pulsante.

2. **Brand Safety Score** — Score automático (0-100) que indica se é seguro para marcas se associarem ao influenciador naquele momento. Considera polêmicas recentes, processos judiciais, declarações controversas.

3. **Timeline de Notícias Visual** — Lista cronológica de notícias e menções com chips de sentimento coloridos (verde/amarelo/vermelho) e links para as fontes.

4. **Atualização da Análise 360°** — O `full_360` no Edge Function `analyze-influencer` passará a incluir a pesquisa de reputação como 4ª dimensão, gerando um relatório completo: Conteúdo + Sentimento + Autenticidade + **Reputação**.

## Alterações

### 1. Nova Edge Function: `research-influencer-reputation`
- Usa Lovable AI Gateway (Gemini 2.5 Pro) com prompt de pesquisa web
- Busca notícias, reportagens, polêmicas, processos sobre o influenciador
- Analisa sentimento de cada resultado
- Calcula Brand Safety Score e Reputation Score
- Retorna JSON estruturado

### 2. Modificar `analyze-influencer/index.ts`
- No modo `full_360`, adicionar chamada à nova função `researchReputation` em paralelo
- Incluir `reputation_analysis` no resultado final

### 3. Modificar `InfluencerProfile360.tsx`
- Adicionar 7ª aba: **"Reputação"** (ícone: Newspaper/AlertTriangle)
- Botão "Pesquisar Reputação" que chama a nova Edge Function
- Exibir: Risk Level badge, Brand Safety meter, News Timeline, Controversies list, Media Sentiment chart, Strategic Recommendation
- Tabs passa de `grid-cols-6` para `grid-cols-7`

### 4. Modificar `InfluencerProfileCard.tsx`
- Se `analysis.reputation_analysis.crisis_alerts` tiver itens ativos, mostrar badge pulsante de alerta no card

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/research-influencer-reputation/index.ts` | Criar — Edge Function de pesquisa de reputação |
| `supabase/functions/analyze-influencer/index.ts` | Modificar — adicionar `researchReputation` ao `full_360` |
| `src/components/marketing/influencers/InfluencerProfile360.tsx` | Modificar — nova aba Reputação com UI completa |
| `src/components/marketing/influencers/InfluencerProfileCard.tsx` | Modificar — badge de alerta de crise |

