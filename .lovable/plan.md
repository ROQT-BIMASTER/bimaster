

# Completar Integração Phyllo — Conectar Dados na Página

## Problemas Identificados

A infraestrutura já está criada (4 edge functions, 3 tabelas Phyllo, componentes UI), mas os dados não fluem corretamente:

1. **URL staging vs production** — `phyllo-create-user` e `phyllo-create-sdk-token` apontam para `api.staging.getphyllo.com`, enquanto `phyllo-proxy` aponta para `api.getphyllo.com`
2. **Contas não são salvas** — O callback `onAccountConnected` do PhylloConnect SDK não salva a conta na tabela `phyllo_accounts`
3. **Página lê tabela errada** — `SocialNetworksPage` consulta `social_media_accounts_safe` (view antiga) em vez de `phyllo_accounts`
4. **Abas Conteúdo e Receita offline** — Lêem de tabelas locais (`influencer_posts`, `influencer_income`) em vez de chamar a API Phyllo via `phyllo-proxy`

## Implementação

### 1. Unificar URL base nas Edge Functions

Alterar `phyllo-create-user` e `phyllo-create-sdk-token` para usar `https://api.staging.getphyllo.com/v1` consistentemente (ambiente staging do usuário). Também atualizar `phyllo-proxy` para staging.

### 2. PhylloConnectButton — Salvar conta conectada

No callback `onAccountConnected`, chamar `phyllo-proxy` com action `get_profile` para buscar dados da conta recém-conectada, e então inserir na tabela `phyllo_accounts` via Supabase client.

### 3. SocialNetworksPage — Ler de phyllo_accounts

Trocar a query de `social_media_accounts_safe` para `phyllo_accounts`, filtrando por `user_id` do usuário autenticado. Ajustar os campos do card (avatar_url, follower_count, etc).

### 4. ContentTab — Buscar via API Phyllo

Substituir a query local por chamada a `phyllo-proxy` com action `get_engagement` usando o `phyllo_account_id` da conta selecionada.

### 5. IncomeTab — Buscar via API Phyllo

Substituir a query local por chamada a `phyllo-proxy` com action `get_income`.

### 6. Ajustar SocialAccountCard

Atualizar a interface para receber os campos de `phyllo_accounts` (avatar_url, follower_count, following_count, phyllo_account_id).

## Arquivos

| Arquivo | Acao |
|---|---|
| `supabase/functions/phyllo-create-user/index.ts` | Modificar — confirmar URL staging |
| `supabase/functions/phyllo-create-sdk-token/index.ts` | Modificar — confirmar URL staging |
| `supabase/functions/phyllo-proxy/index.ts` | Modificar — trocar URL para staging |
| `src/components/marketing/social/PhylloConnectButton.tsx` | Modificar — salvar conta no callback |
| `src/pages/SocialNetworksPage.tsx` | Modificar — ler de phyllo_accounts |
| `src/components/marketing/social/SocialAccountCard.tsx` | Modificar — campos de phyllo_accounts |
| `src/components/marketing/social/SocialAccountPanel.tsx` | Modificar — ContentTab e IncomeTab via API |

