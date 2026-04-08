

# Influenciadores por Região e Estado

## Objetivo

Adicionar campos de região/UF aos influenciadores e criar uma visão de ranking filtrada por região e estado, permitindo identificar os melhores influenciadores em cada localidade.

## Mudanças

### 1. Migração — adicionar colunas `regiao` e `uf` na tabela `influencers`

```sql
ALTER TABLE public.influencers ADD COLUMN uf TEXT;
ALTER TABLE public.influencers ADD COLUMN regiao TEXT;
```

### 2. Atualizar `AddInfluencerDialog.tsx`

- Adicionar campos de seleção: **Região** (dropdown com Norte, Nordeste, Centro-Oeste, Sudeste, Sul) e **Estado/UF** (dropdown filtrado pela região selecionada, usando `REGIOES_UFS` de `src/lib/constants/regioes.ts`)
- Região e UF são opcionais no cadastro

### 3. Atualizar `InfluencerDashboard.tsx`

- Adicionar dois novos filtros no topo: **Região** e **UF**
- Filtrar a lista de influenciadores por região/UF selecionados
- Ao selecionar uma região, o filtro de UF mostra apenas os estados daquela região

### 4. Atualizar `InfluencerRankingPanel.tsx`

- Adicionar coluna "Região/UF" na tabela de ranking, exibindo UF e região de cada influenciador
- Manter estilo profissional (texto simples, sem emojis)

### 5. Atualizar `influencer-autopilot` edge function — action `analyze_audience`

- Incluir na análise de IA a estimativa de região/estado de atuação principal do influenciador
- Ao salvar resultado, atualizar os campos `regiao` e `uf` do influenciador automaticamente se estiverem vazios

### 6. Atualizar `InfluencerProfileCard.tsx`

- Exibir região/UF no card do influenciador (badge discreta)

## Arquivos

| Arquivo | Ação |
|---|---|
| Migração SQL | Adicionar colunas `uf` e `regiao` em `influencers` |
| `src/components/marketing/influencers/AddInfluencerDialog.tsx` | Modificar — campos região/UF |
| `src/components/marketing/influencers/InfluencerDashboard.tsx` | Modificar — filtros região/UF |
| `src/components/marketing/influencers/InfluencerRankingPanel.tsx` | Modificar — coluna região/UF |
| `src/components/marketing/influencers/InfluencerProfileCard.tsx` | Modificar — exibir região/UF |
| `supabase/functions/influencer-autopilot/index.ts` | Modificar — estimar região na análise de audiência |

