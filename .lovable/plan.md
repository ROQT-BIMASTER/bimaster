

# Nova Seção "Redes Sociais" no Sidebar do Dashboard

## Resumo

Criar uma página dedicada `/dashboard/marketing/redes-sociais` acessível pelo sidebar do Marketing, consolidando: conexão de contas via Phyllo SDK, lista de contas conectadas com cards visuais, e abas para Conteúdo, Audiência, Receita e Publicação — tudo alimentado pela integração Phyllo existente.

## Arquitetura

A rota já se encaixa no módulo Marketing existente. A página reutiliza componentes e edge functions já criados (`phyllo-proxy`, `fetch-influencer-content`, `InfluencerPublish`), reorganizando-os em uma experiência unificada.

## Implementação

### 1. Adicionar item no sidebar e rota

**`src/components/dashboard/AppSidebar.tsx`** — Adicionar em `marketingSubMenus`:
```typescript
{ title: "Redes Sociais", url: "/dashboard/marketing/redes-sociais", icon: Share2, screenCode: "MARKETING_SOCIAL" }
```

**`src/App.tsx`** — Nova rota:
```typescript
<Route path="/dashboard/marketing/redes-sociais" element={<ModuleRoute moduleCode="marketing"><ScreenProtectedRoute screenCode="marketing_social"><SocialNetworksPage /></ScreenProtectedRoute></ModuleRoute>} />
```

### 2. Criar página principal

**`src/pages/SocialNetworksPage.tsx`** — Layout com `DashboardLayout`:
- Header com título + botão "Conectar Rede Social"
- Grid de cards das contas conectadas (busca de `social_media_accounts`)
- Ao clicar num card, abre painel de detalhes com abas

### 3. Componente de Conexão — PhylloConnectButton

**`src/components/marketing/social/PhylloConnectButton.tsx`**:
- Botão "Conectar Rede Social" que chama `phyllo-proxy` com `create_user` + `create_sdk_token`
- Carrega o Phyllo Connect SDK via script tag dinâmico
- Callback de sucesso salva a conta em `social_media_accounts`

### 4. Card de conta conectada

**`src/components/marketing/social/SocialAccountCard.tsx`**:
- Foto de perfil (avatar_url ou placeholder por plataforma)
- Nome da conta, plataforma (badge com ícone), seguidores
- Indicador de status (ativo/erro/sincronizando)
- Clique abre o painel de detalhes

### 5. Painel de detalhes com abas

**`src/components/marketing/social/SocialAccountPanel.tsx`** — Sheet/Dialog com 4 abas:

- **Conteúdo**: Grid de posts recentes via `phyllo-proxy` (`get_content`) com thumbnail, legenda, likes, comments, shares, data. Reutiliza dados de `influencer_posts` se disponíveis.
- **Audiência**: Gráficos de demografia (idade, gênero, cidade/país) via `phyllo-proxy` (`get_audience`). Usa Recharts (PieChart, BarChart).
- **Receita**: Tabela de transações via `phyllo-proxy` (`get_income`) com data, valor, tipo, plataforma. Busca de `influencer_income` se já sincronizado.
- **Publicação**: Formulário para publicar conteúdo via Phyllo (`publish_content`). Reutiliza lógica do `InfluencerPublish` existente com campos: tipo, visibilidade, título, descrição, URL de mídia.

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/SocialNetworksPage.tsx` | Criar — página principal |
| `src/components/marketing/social/PhylloConnectButton.tsx` | Criar — botão de conexão SDK |
| `src/components/marketing/social/SocialAccountCard.tsx` | Criar — card visual da conta |
| `src/components/marketing/social/SocialAccountPanel.tsx` | Criar — painel com 4 abas |
| `src/components/dashboard/AppSidebar.tsx` | Modificar — adicionar item "Redes Sociais" no submenu marketing |
| `src/App.tsx` | Modificar — adicionar rota |

