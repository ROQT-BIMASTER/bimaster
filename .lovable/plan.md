

## Plano: Criar Edge Function para Webhook da Pluggy

### O que será feito
Criar uma nova edge function `pluggy-webhook` dedicada a receber eventos de webhook da Pluggy (item/created, item/updated, item/error). O webhook é público (chamado pela Pluggy, sem JWT do usuário), então precisa responder rapidamente (< 5 segundos) com status 2XX.

### Alterações

**1. `supabase/functions/pluggy-webhook/index.ts`** — Nova função:
- Endpoint POST público que recebe eventos da Pluggy
- Trata 3 tipos de evento:
  - `item/created` → Registra log, opcionalmente busca dados da conexão via `pluggy-sdk`
  - `item/updated` → Usa `pluggy-sdk` para buscar transações atualizadas do item e atualiza `bank_connections` com status e timestamp
  - `item/error` → Atualiza `bank_connections` com status `error` e registra o erro
- Responde imediatamente com `{ received: true }` (dentro do limite de 5s)
- Processamento pesado feito de forma assíncrona (fire-and-forget com `.catch()`)
- Sem autenticação JWT (webhook externo), mas valida estrutura do payload

**2. `supabase/config.toml`** — Adicionar:
```toml
[functions.pluggy-webhook]
  verify_jwt = false
```

### Segurança
- Função pública (necessário para webhooks externos)
- Credenciais Pluggy (`PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`) já configuradas como secrets e acessadas apenas server-side
- Validação da estrutura do payload recebido

### URL do Webhook
Após deploy, a URL para configurar no painel da Pluggy será:
`https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/pluggy-webhook`

Você precisará registrar essa URL no [Dashboard da Pluggy](https://dashboard.pluggy.ai) em **Settings → Webhooks**.

