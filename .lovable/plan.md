

## Plano: Migrar Edge Function para usar `pluggy-sdk` oficial

### Situação Atual
- A edge function `conciliacao-bancaria` já existe e faz chamadas HTTP diretas à API Pluggy
- Os secrets `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` já estão configurados
- A função **não está registrada** no `config.toml` (falta `[functions.conciliacao-bancaria]`)

### Problemas a Corrigir
1. **config.toml**: Adicionar entrada `[functions.conciliacao-bancaria]` com `verify_jwt = false` (auth é feita internamente)
2. **SDK**: Substituir chamadas HTTP manuais pelo pacote `pluggy-sdk` oficial via `npm:pluggy-sdk`
3. **Simplificação**: O SDK gerencia autenticação automaticamente (troca de client_id/secret por API key internamente)

### Alterações

**`supabase/config.toml`** — Adicionar:
```toml
[functions.conciliacao-bancaria]
  verify_jwt = false
```

**`supabase/functions/conciliacao-bancaria/index.ts`** — Refatorar:
- Importar `PluggyClient` de `npm:pluggy-sdk`
- Substituir `getPluggyApiKey()` + fetch manual por instância do SDK
- `handleConnect`: usar `pluggy.createConnectToken({ clientUserId })`
- `handleSyncTransactions`: usar `pluggy.fetchAccounts(itemId)` e `pluggy.fetchTransactions(accountId, { from, to })`
- Manter toda lógica de matching (3 tiers) e integração com `contas_pagar` inalterada
- Credenciais continuam server-side via `Deno.env.get("PLUGGY_CLIENT_ID")` e `PLUGGY_CLIENT_SECRET`

### Segurança
- Credenciais nunca expostas ao frontend — apenas a edge function acessa os secrets
- Auth do usuário validada internamente via JWT antes de qualquer operação

