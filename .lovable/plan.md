

# Adicionar App ID (client_id) e App Secret ao Cadastro de Contas

## Problema

A Meta API exige o **App ID** (client_id) e **App Secret** para operações como troca de token curto para longo e validação. Atualmente o formulário e a tabela não possuem esses campos.

## Solução

### 1. Migration — Adicionar colunas na tabela `social_media_accounts`
- `app_id TEXT` — armazena o App ID da Meta (não é segredo)
- `app_secret_encrypted BYTEA` — armazena o App Secret criptografado via Vault (mesmo padrão do access_token)

### 2. Formulário `AccountsManager.tsx`
Adicionar dois campos ao formulário:
- **App ID (client_id)** — campo texto, obrigatório para Instagram/Facebook
- **App Secret** — campo password, obrigatório para Instagram/Facebook
- Mostrar esses campos apenas quando a plataforma for `instagram` ou `facebook`

### 3. Edge Function `save-social-account`
- Receber `app_id` e `app_secret` no body
- Criptografar `app_secret` via `encrypt_token()` (mesmo RPC do access_token)
- Salvar `app_id` e `app_secret_encrypted` na tabela

### 4. Edge Function `social-media-metrics`
- Ao buscar a conta por `accountId`, incluir `app_id` e `app_secret_encrypted` no select
- Decriptar `app_secret` quando necessário
- Usar App ID + App Secret para trocar token de curta para longa duração automaticamente (endpoint `oauth/access_token`)
- Se o token atual falhar com code 190 (expirado), tentar renovação automática antes de retornar erro

## Fluxo de troca de token (automático)

```text
1. Token curto (1h) fornecido pelo usuário
2. Edge function detecta token curto ou expirado
3. Chama: graph.facebook.com/v19.0/oauth/access_token
   ?grant_type=fb_exchange_token
   &client_id={app_id}
   &client_secret={app_secret}
   &fb_exchange_token={token_curto}
4. Recebe token longo (~60 dias)
5. Criptografa e atualiza no banco
```

## Arquivos

| Arquivo | Alteração |
|---|---|
| Migration SQL | Adicionar `app_id` e `app_secret_encrypted` à tabela |
| `src/components/marketing/social/AccountsManager.tsx` | Campos App ID e App Secret no formulário |
| `supabase/functions/save-social-account/index.ts` | Receber e criptografar app_secret |
| `supabase/functions/social-media-metrics/index.ts` | Buscar app_id/secret, troca automática de token |

