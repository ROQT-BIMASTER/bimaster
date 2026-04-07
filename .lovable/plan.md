

# Instagram — Consultas Expandidas (Somente Leitura)

## Resumo

Configurar os secrets META_APP_ID / META_APP_SECRET para estabilidade de token e expandir as consultas do Instagram para trazer posts, stories, reels, insights de audiência e crescimento — tudo somente leitura.

## Passo 1 — Configurar Secrets

Solicitar ao usuário os valores de `META_APP_ID` e `META_APP_SECRET` do App "bimaster" (ID 143265964865867) para que a troca de token funcione e as consultas não expirem a cada hora.

## Passo 2 — Expandir Edge Function `social-media-metrics`

Adicionar novas ações de consulta dentro da função existente (ou criar `instagram-insights`):

- **`get_recent_media`** — Busca os últimos 25 posts com: imagem, legenda, tipo (IMAGE/VIDEO/CAROUSEL), likes, comentários, data, permalink
- **`get_stories`** — Stories ativos com impressões, alcance, respostas
- **`get_reels`** — Reels com plays, likes, comentários, shares
- **`get_audience_insights`** — Demografia (idade, gênero, cidade, país) via `/insights` endpoint
- **`get_growth`** — Evolução de seguidores via `follower_count` insight (últimos 30 dias)

Todos usando a Graph API v19.0 com os endpoints:
- `/{ig-user-id}/media` — posts
- `/{ig-user-id}/stories` — stories
- `/{ig-user-id}/insights` — audiência e crescimento

## Passo 3 — Nova Edge Function `instagram-insights`

Criar função dedicada que recebe `accountId` + `action` e retorna dados formatados. Reutiliza a lógica de decrypt de token existente.

## Passo 4 — Tela de Detalhes do Instagram no Frontend

Novo componente `InstagramAccountDetails.tsx` que aparece ao clicar em uma conta Instagram no dashboard:

- **Aba Posts**: Grid de posts recentes com thumbnail, legenda truncada, likes/comments, data
- **Aba Stories/Reels**: Cards com métricas de visualização
- **Aba Audiência**: Gráficos de pizza (gênero, idade) e barras (cidades/países)
- **Aba Crescimento**: Linha temporal de seguidores nos últimos 30 dias

## Passo 5 — Integrar no MultiAccountDashboard

Adicionar botão "Ver Detalhes" no `AccountCard` que abre o `InstagramAccountDetails` em um Dialog/Sheet.

## Permissões Necessárias do Token

Para consultas, o token precisa dos escopos:
- `instagram_basic` — perfil e mídia
- `instagram_manage_insights` — insights e audiência
- `pages_show_list` — listar páginas (para fallback via Facebook Page)

Sem `instagram_manage_insights`, audiência e crescimento não funcionam — mas posts e métricas básicas sim.

## Arquivos

| Arquivo | Ação |
|---|---|
| Secrets | Solicitar META_APP_ID e META_APP_SECRET |
| `supabase/functions/instagram-insights/index.ts` | Criar — consultas expandidas |
| `src/components/marketing/social/InstagramAccountDetails.tsx` | Criar — tela de detalhes |
| `src/components/marketing/social/AccountCard.tsx` | Modificar — botão "Ver Detalhes" |

