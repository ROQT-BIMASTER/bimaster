

# Adicionar abas Perfil e Engajamento ao SocialAccountPanel

## Situação Atual

O painel já possui 4 abas: **Conteúdo**, **Audiência**, **Receita**, **Publicar**. Faltam as abas **Perfil** e **Engajamento**. A Edge Function `phyllo-proxy` já suporta todas as actions necessárias (`get_profile`, `get_engagement`, `get_audience`, `get_income`).

## Alterações

### 1. Modificar `SocialAccountPanel.tsx`

- Adicionar aba **Perfil** (tab `profile`, default) — chama `phyllo-proxy` com `action: "get_profile"` e exibe: avatar, nome, bio, seguidores, seguindo, plataforma, URL do perfil, data de criação
- Adicionar aba **Engajamento** (tab `engagement`) — chama `phyllo-proxy` com `action: "get_engagement"` e calcula métricas agregadas: total de curtidas, comentários, compartilhamentos, views, taxa de engajamento média, e gráfico de engajamento por post (BarChart)
- Reordenar abas para: **Perfil** → **Conteúdo** → **Audiência** → **Engajamento** → **Receita** (remover aba Publicar ou mantê-la como 6ª)
- Ajustar o grid de `grid-cols-4` para `grid-cols-5` (ou `grid-cols-6` se manter Publicar)

### 2. Componente `ProfileTab`

Exibe dados do perfil da conta via `get_profile`:
- Avatar grande + username + bio
- Cards com métricas: seguidores, seguindo, posts
- Link para perfil externo
- Plataforma e status

### 3. Componente `EngagementTab`

Exibe métricas agregadas via `get_engagement`:
- Cards resumo no topo: total likes, comments, shares, avg engagement rate
- Gráfico de barras com engajamento por post (top 10)
- Post com melhor desempenho destacado

### Arquivos modificados

| Arquivo | Ação |
|---|---|
| `src/components/marketing/social/SocialAccountPanel.tsx` | Adicionar ProfileTab, EngagementTab, reordenar abas |

Nenhuma alteração na Edge Function é necessária — `get_profile` e `get_engagement` já estão implementados.

