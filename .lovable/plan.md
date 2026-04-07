

# Expandir Integração Phyllo — Todas as APIs Disponíveis

## Situação Atual

O `phyllo-proxy` suporta apenas 5 ações: `create_user`, `create_sdk_token`, `get_profile`, `get_audience`, `get_engagement`. A API Phyllo oferece muito mais.

## APIs Phyllo Disponíveis (não implementadas)

Com base na documentação oficial, estas são as APIs que o Phyllo oferece e que podemos integrar:

### 1. Identity API (parcialmente implementada)
- **Profiles** (`GET /v1/social/profiles`) — lista todos os perfis conectados
- **Accounts** (`GET /v1/social/accounts`) — contas de redes sociais com métricas de reputação (seguidores, following, subscribers)
- Já temos `get_profile` para uma conta específica

### 2. Audience API (parcialmente implementada)
- **Demographics** (`GET /v1/social/accounts/{id}/audience`) — idade, gênero, localização geográfica, idiomas da audiência
- Já temos `get_audience` mas não processamos os dados demográficos no frontend

### 3. Engagement API (parcialmente implementada)
- **Content Search** (`POST /v1/social/content/search`) — busca de posts com filtros
- **Content Item** (`GET /v1/social/content/{id}`) — detalhes de um post específico
- **Comments** (`GET /v1/social/content/{id}/comments`) — comentários de um post específico
- Já temos busca de content, mas **NÃO** temos comentários via Phyllo

### 4. Income API (nova)
- **Transactions** (`GET /v1/social/income/transactions`) — receitas do criador por plataforma
- **Payouts** (`GET /v1/social/income/payouts`) — histórico de pagamentos
- Permite entender o valor de mercado do influenciador

### 5. Publish API (nova)
- **Create Content** (`POST /v1/social/content/publish`) — publicar conteúdo em nome do criador
- Permite agendar e publicar posts diretamente nas plataformas conectadas

### 6. Search/Discovery API (já usada parcialmente)
- **Creator Search** (`POST /v1/social/creators/search`) — busca pública por username/plataforma
- Já usamos no `fetch-influencer-content`, mas sem explorar todos os campos retornados

### 7. Webhooks
- Notificações em tempo real quando dados são atualizados (profile, content, income)
- Permite manter dados sincronizados automaticamente

## Plano de Implementação

### Passo 1 — Expandir `phyllo-proxy` com novas ações

Adicionar ao switch/case:
- `get_comments` — buscar comentários reais de posts via `/v1/social/content/{id}/comments`
- `get_income` — buscar transações de receita via `/v1/social/income/transactions`
- `get_payouts` — buscar pagamentos via `/v1/social/income/payouts`
- `search_creators` — busca pública de criadores via `/v1/social/creators/search`
- `get_content_item` — detalhes de um post via `/v1/social/content/{id}`
- `publish_content` — publicar conteúdo via `/v1/social/content/publish`
- `get_all_profiles` — listar todos os perfis conectados
- `get_all_accounts` — listar todas as contas

### Passo 2 — Atualizar `fetch-influencer-content` para usar comentários reais

Em vez de gerar comentários via IA, buscar comentários reais do Phyllo usando a nova ação `get_comments`. Manter fallback de IA apenas quando Phyllo não estiver disponível.

### Passo 3 — Nova aba "Receita" no Perfil 360°

Adicionar aba no `InfluencerProfile360.tsx`:
- Histórico de transações e receitas por plataforma
- Estimativa de valor de mercado baseada nos dados de income
- Gráfico de receita ao longo do tempo

### Passo 4 — Nova aba "Audiência Detalhada" no Perfil 360°

Expandir a aba de visão geral com dados demográficos reais do Phyllo:
- Distribuição por idade e gênero (gráficos)
- Top países e cidades
- Idiomas predominantes

### Passo 5 — Publicação de conteúdo (Publish API)

Novo componente para publicar conteúdo em nome de influenciadores conectados (quando o criador deu consentimento via Phyllo SDK).

### Passo 6 — Webhook para sincronização automática

Criar edge function `phyllo-webhook` que recebe notificações do Phyllo quando dados são atualizados, mantendo o banco sempre atualizado sem necessidade de sync manual.

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/phyllo-proxy/index.ts` | Modificar — adicionar 8 novas ações |
| `supabase/functions/fetch-influencer-content/index.ts` | Modificar — usar comentários reais do Phyllo |
| `supabase/functions/phyllo-webhook/index.ts` | Criar — receptor de webhooks |
| `src/components/marketing/influencers/InfluencerProfile360.tsx` | Modificar — abas Receita e Audiência |
| `src/components/marketing/influencers/InfluencerPublish.tsx` | Criar — publicação de conteúdo |
| Migration SQL | Adicionar tabela `influencer_income` para armazenar transações |

## Nota Importante

As APIs de **Income**, **Audience Demographics** e **Publish** requerem que o criador tenha **conectado sua conta via Phyllo SDK** (consentimento). A busca pública (`search_creators`) funciona sem consentimento mas retorna dados limitados. O plano mantém o fallback de IA para criadores que não conectaram suas contas.

