

# Autopilot: Mineração e Aprovação de Novos Influenciadores

## Objetivo

O Autopilot passa a descobrir automaticamente novos influenciadores com base no perfil da empresa (segmento, público-alvo, plataformas preferidas) e os coloca em uma fila de aprovação pendente. O usuário revisa e aprova/rejeita antes de incluir no painel.

## Abordagem

### 1. Tabela `influencer_suggestions` (migração)

Armazena sugestões descobertas pelo Autopilot aguardando aprovação:
- `id`, `user_id`, `username`, `display_name`, `platform`, `profile_url`, `followers_count`, `engagement_rate`, `niche`, `reason` (por que a IA sugeriu), `score` (relevância para o perfil)
- `status`: `pending` | `approved` | `rejected` (default `pending`)
- `reviewed_at`, `created_at`
- RLS por `user_id`

### 2. Edge Function `influencer-autopilot` — nova action `discover_new`

Adicionar action que:
- Lê o perfil da empresa (segmento, público, plataformas, valores)
- Chama a IA para sugerir 10-15 influenciadores relevantes que **não estão** na base do usuário
- Cruza com influenciadores já cadastrados para evitar duplicatas
- Insere resultados na `influencer_suggestions` com `status = pending`

### 3. Componente `InfluencerSuggestionsPanel.tsx`

Painel visual na dashboard com:
- Lista de sugestões pendentes com username, plataforma, seguidores, nicho, motivo da sugestão, score
- Botões "Aprovar" (cria influenciador na tabela `influencers`) e "Rejeitar" (marca como rejected)
- Botão "Aprovar Todos" para ação em lote
- Badge no painel Autopilot indicando quantidade de sugestões pendentes
- Filtro por plataforma

### 4. Integração

- Adicionar o painel na `InfluencerDashboard.tsx` quando Autopilot está ativo
- O botão de executar Autopilot também dispara a mineração de novos influenciadores
- Badge de notificação no `AutopilotMiningPanel` com contagem de pendentes

## Arquivos

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar tabela `influencer_suggestions` com RLS |
| `supabase/functions/influencer-autopilot/index.ts` | Modificar — adicionar action `discover_new` |
| `src/components/marketing/influencers/InfluencerSuggestionsPanel.tsx` | Criar — painel de aprovação |
| `src/components/marketing/influencers/InfluencerDashboard.tsx` | Modificar — integrar painel de sugestões |
| `src/components/marketing/influencers/AutopilotMiningPanel.tsx` | Modificar — badge de pendentes |

