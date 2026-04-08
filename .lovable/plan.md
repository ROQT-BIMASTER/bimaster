

# Central de Inteligência de Influenciadores — Ranking, Monitoramento Automático e Perfil da Empresa

## Visão Geral

Transformar o módulo de influenciadores de uma lista estática em uma **Central de Inteligência com IA** que:
1. Calcula um **Score Composto** e rankeia influenciadores automaticamente
2. Oferece um **Painel de Oportunidades em Tempo Real** com IA
3. Permite **busca e análise automática** quando a flag estiver ligada (autopilot)
4. Tem um **Perfil da Empresa** editável que alimenta a IA com contexto para buscas mais inteligentes

## Arquitetura

```text
┌─────────────────────────────────────────────────────────────┐
│                  InfluencerDashboard                         │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ CompanyProfile│  │ Ranking +    │  │ AI Opportunities │  │
│  │ (drawer)     │  │ Score Cards  │  │ Panel (live)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Autopilot Toggle: IA busca e analisa automaticamente │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 1. Tabela `influencer_company_profile`

Armazena informações da empresa/marca do usuário para contextualizar a IA:

| Coluna | Tipo | Descrição |
|---|---|---|
| `user_id` | uuid (PK, FK) | Dono do perfil |
| `company_name` | text | Nome da empresa |
| `segment` | text | Segmento/nicho |
| `target_audience` | text | Público-alvo |
| `brand_values` | text | Valores da marca |
| `products_services` | text | Produtos/serviços |
| `competitors` | text | Concorrentes |
| `preferred_platforms` | text[] | Plataformas preferidas |
| `budget_range` | text | Faixa de orçamento |
| `campaign_goals` | text | Objetivos de campanha |
| `brand_tone` | text | Tom de comunicação |
| `autopilot_enabled` | boolean | Flag de busca automática |
| `autopilot_frequency` | text | Frequência (daily/weekly) |
| `last_autopilot_run` | timestamptz | Última execução |

## 2. Colunas adicionais em `influencers`

| Coluna | Tipo | Descrição |
|---|---|---|
| `composite_score` | numeric | Score composto (0-100) |
| `rank_position` | integer | Posição no ranking |
| `opportunity_score` | numeric | Score de oportunidade para a marca |
| `last_analyzed_at` | timestamptz | Última análise automática |

## 3. Score Composto — Cálculo

A IA calcula um score unificado ponderado:

- **Engajamento** (30%): engagement_rate vs benchmark da plataforma
- **Autenticidade** (25%): fraud_score
- **Brand Safety** (20%): reputation/brand_safety_score
- **Alcance** (15%): followers_count normalizado
- **Atividade** (10%): frequência de posts, last_synced

## 4. Novos Componentes UI

### `CompanyProfileDrawer`
- Formulário lateral para preencher dados da empresa
- Campos: nome, segmento, público-alvo, valores, produtos, concorrentes, plataformas, orçamento, tom
- Toggle "Autopilot" com seletor de frequência (diário/semanal)
- Botão "Minha Empresa" no dashboard

### `InfluencerRankingPanel`
- Substitui o grid atual por uma **tabela rankeada** com:
  - Posição (#1, #2, #3 com medalhas)
  - Avatar + nome + plataforma
  - Score Composto (barra de progresso colorida)
  - Mini badges: engajamento, autenticidade, brand safety
  - Trend arrow (subiu/desceu vs última análise)
- Ordenação por: Score, Engajamento, Seguidores, Brand Safety
- Toggle entre visualização Grid (atual) e Ranking

### `AIOpportunitiesPanel`
- Card expandível no topo do dashboard
- IA analisa todos os influenciadores + perfil da empresa e gera:
  - **Top 3 Oportunidades**: influenciadores mais alinhados
  - **Alertas**: quem está em crise ou caiu de engajamento
  - **Tendências**: nichos em alta, plataformas com melhor ROI
  - **Ações sugeridas**: "Contactar @fulano agora — engajamento subiu 40% esta semana"
- Botão "Atualizar Análise" manual + execução automática se autopilot ligado

### `AutopilotBadge`
- Badge animada verde "🤖 Autopilot ON" quando habilitado
- Mostra última execução e próxima agendada

## 5. Edge Function `influencer-autopilot`

Função que roda sob demanda ou via cron:
1. Carrega `influencer_company_profile` do usuário
2. Para cada influenciador ativo:
   - Calcula `composite_score` usando últimas análises
   - Atualiza `rank_position`
3. Chama a IA com contexto da empresa para gerar `opportunity_score`
4. Se autopilot: executa `discover-influencers` com query baseada no perfil da empresa e adiciona automaticamente os melhores
5. Salva resultado como `influencer_analyses` tipo `autopilot_report`

## 6. Edge Function `calculate-influencer-scores`

Função dedicada para recalcular scores:
- Calcula `composite_score` para cada influenciador
- Atualiza `rank_position` (ORDER BY composite_score DESC)
- Chamada pelo autopilot e pelo botão manual "Recalcular Ranking"

## Arquivos

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar `influencer_company_profile`, adicionar colunas em `influencers` |
| `src/components/marketing/influencers/CompanyProfileDrawer.tsx` | Criar — Formulário do perfil da empresa + toggle autopilot |
| `src/components/marketing/influencers/InfluencerRankingPanel.tsx` | Criar — Tabela rankeada com scores compostos |
| `src/components/marketing/influencers/AIOpportunitiesPanel.tsx` | Criar — Painel de oportunidades com IA |
| `src/components/marketing/influencers/InfluencerDashboard.tsx` | Modificar — Integrar novos painéis, toggle grid/ranking, botão empresa |
| `supabase/functions/influencer-autopilot/index.ts` | Criar — Busca automática + scoring + oportunidades |
| `supabase/functions/analyze-influencer/index.ts` | Modificar — Adicionar `analysis_type: "scoring"` para cálculo de score |

