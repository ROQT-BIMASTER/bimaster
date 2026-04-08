

# Perfil de Consumidor do Influenciador — Análise por Idade e Gênero via IA

## Objetivo

Adicionar na aba "Audiência" do Perfil 360° uma análise completa do perfil de consumidor que o influenciador atinge, com breakdown por faixa etária e gênero — gerada por IA quando dados do Phyllo não estiverem disponíveis.

## Situação Atual

A aba "Audiência" depende exclusivamente da API Phyllo (requer que o criador conecte a conta). Quando não há dados, exibe apenas um botão sem informação útil. A maioria dos influenciadores cadastrados manualmente não terá esses dados.

## Abordagem

### 1. Análise de Audiência via IA (Edge Function)

Adicionar action `analyze_audience` na edge function `influencer-autopilot`:
- Recebe `influencer_id`
- Lê dados do influenciador (plataforma, nicho, seguidores, posts recentes)
- Pede à IA uma estimativa do perfil demográfico com:
  - Distribuição por gênero (%)
  - Distribuição por faixa etária (13-17, 18-24, 25-34, 35-44, 45-54, 55+)
  - Perfil de consumidor (poder aquisitivo, interesses, comportamento de compra)
  - Persona resumida do seguidor típico
- Persiste resultado em `influencer_analyses` com `analysis_type = 'audience_profile'`

### 2. Componente `AudienceProfileSection`

Novo componente visual com:
- **Cards de gênero** com barras de progresso coloridas (azul/rosa/cinza)
- **Gráfico de faixa etária** com barras horizontais
- **Card "Persona do Seguidor"** com descrição textual gerada pela IA
- **Card "Perfil de Consumo"** — poder aquisitivo, interesses, hábitos
- Botão "Analisar Perfil de Audiência" para gerar/atualizar via IA
- Indicador de que é estimativa baseada em IA (diferente de dados reais do Phyllo)

### 3. Integração na Aba Audiência

Modificar `AudienceTab` no `InfluencerProfile360.tsx`:
- Quando há dados Phyllo: exibe dados reais (como hoje)
- Sempre exibe abaixo a seção "Perfil de Consumidor (IA)" com análise estimada
- Ao abrir a aba, carrega análise salva do banco automaticamente

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/influencer-autopilot/index.ts` | Modificar — adicionar action `analyze_audience` |
| `src/components/marketing/influencers/AudienceProfileSection.tsx` | Criar — seção visual de perfil demográfico |
| `src/components/marketing/influencers/InfluencerProfile360.tsx` | Modificar — integrar seção na aba Audiência |

