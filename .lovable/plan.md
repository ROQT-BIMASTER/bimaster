

# Proteger Token da Meta — Criptografia Server-Side

## Problema Atual

Existem **duas vulnerabilidades** no fluxo de cadastro de contas:

1. **AccountsManager.tsx** insere `access_token` em texto puro diretamente na tabela — mas essa coluna foi removida na migration anterior. O campo correto é `access_token_encrypted` (BYTEA, criptografado via Vault).
2. **MultiAccountDashboard.tsx** lê `account.access_token` (que não existe mais) e envia ao frontend para sincronização — o token nunca deveria transitar pelo cliente.

As edge functions `sync-all-accounts` e `social-media-cron` já fazem corretamente: leem `access_token_encrypted` e decriptam server-side via `decrypt_token()`.

## Solução

### 1. Nova Edge Function `save-social-account`
O frontend enviará os dados da conta (incluindo token) para uma edge function que:
- Valida autenticação do usuário (JWT)
- Criptografa o token via `encrypt_token()` (Vault)
- Insere na tabela com `access_token_encrypted`
- Retorna sucesso (sem o token)

O token transita apenas uma vez (HTTPS, frontend → edge function) e é imediatamente criptografado no banco.

### 2. Corrigir `AccountsManager.tsx`
- Remover insert direto no Supabase
- Chamar `supabase.functions.invoke('save-social-account', { body: ... })` em vez disso
- O token sai da memória do formulário após envio

### 3. Corrigir `MultiAccountDashboard.tsx`
- Remover `access_token` da interface `SocialAccount` e do `select("*")`
- Na função `syncAccount`, chamar `supabase.functions.invoke('sync-all-accounts')` ou uma edge function dedicada que decripta server-side — o frontend **nunca** recebe o token
- Alternativa simples: invocar `social-media-metrics` passando apenas `accountId`, e a edge function busca/decripta o token internamente

### 4. Ajustar `social-media-metrics` Edge Function
- Aceitar `accountId` como parâmetro alternativo a `token`
- Se `accountId` for fornecido e `token` não, buscar `access_token_encrypted` da tabela e decriptar via `decrypt_token()`
- Isso permite que o frontend sincronize sem nunca ter acesso ao token

## Fluxo Seguro Final

```text
Cadastro:
  Frontend (formulário) → Edge Function save-social-account → encrypt_token() → DB

Sincronização:
  Frontend (botão sync) → Edge Function social-media-metrics (accountId) → decrypt_token() → Meta API → DB
```

O token **nunca** retorna ao frontend em nenhum momento.

## Arquivos

| Arquivo | Alteração |
|---|---|
| `supabase/functions/save-social-account/index.ts` | **Novo** — recebe dados + token, criptografa e salva |
| `supabase/functions/social-media-metrics/index.ts` | Aceitar `accountId` sem `token`, buscar/decriptar server-side |
| `src/components/marketing/social/AccountsManager.tsx` | Chamar edge function em vez de insert direto |
| `src/components/marketing/social/MultiAccountDashboard.tsx` | Remover `access_token` da interface, sync via `accountId` apenas |

