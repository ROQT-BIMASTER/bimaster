# Edge Functions Documentation

Esta documentação descreve as Edge Functions disponíveis no projeto BiMaster/Union CRM.

## 📋 Índice

- [Social Media Metrics](#social-media-metrics)
- [Sync All Accounts](#sync-all-accounts)
- [Datawarehouse API](#datawarehouse-api)
- [Photo Analysis Queue](#photo-analysis-queue)
- [Marketing Insights](#marketing-insights)
- [Segurança e CORS](#segurança-e-cors)

---

## Social Media Metrics

**Path:** `supabase/functions/social-media-metrics`  
**Autenticação:** Requerida (JWT)  
**Método:** POST

### Descrição

Coleta e armazena métricas de redes sociais (Instagram, Facebook, TikTok, LinkedIn, Twitter).

> **⚠️ Criptografia OAuth:** Os tokens são armazenados criptografados via Vault (`access_token_encrypted`). As Edge Functions `social-media-cron` e `sync-all-accounts` decriptam via `supabase.rpc('decrypt_token')` antes de chamar esta função. Tokens plaintext nunca são persistidos.

### Request Body

```json
{
  "accountId": "uuid",
  "platform": "instagram" | "facebook" | "tiktok" | "linkedin" | "twitter",
  "token": "decrypted-oauth-token"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "followers": 1234,
    "engagement": 0.045,
    "posts": 42,
    "reach": 5678
  }
}
```

### Exemplo de Uso

```typescript
import { supabase } from '@/integrations/supabase/client';

const { data, error } = await supabase.functions.invoke('social-media-metrics', {
  body: { 
    accountId: 'account-uuid',
    platform: 'instagram' 
  }
});
```

### Erros Comuns

- `400`: Parâmetros inválidos
- `401`: Não autenticado
- `500`: Erro ao buscar métricas da API externa

---

## Sync All Accounts

**Path:** `supabase/functions/sync-all-accounts`  
**Autenticação:** Requerida (JWT)  
**Método:** POST

### Descrição

Sincroniza todas as contas de redes sociais ativas. Busca contas com `access_token_encrypted`, decripta via `decrypt_token` RPC e invoca `social-media-metrics` para cada conta.

> **⚠️ Criptografia OAuth:** Tokens são decriptados sob demanda via `supabase.rpc('decrypt_token', { p_encrypted })`. A chave de criptografia é gerenciada pelo Supabase Vault (`oauth_encryption_key`).

### Request Body

```json
{
  "userId": "uuid" // Opcional
}
```

### Response

```json
{
  "message": "Sincronização concluída: 5 sucesso, 1 erro(s)",
  "results": {
    "total": 6,
    "synced": 5,
    "errors": 1,
    "details": [
      {
        "account": "nome_conta",
        "platform": "instagram",
        "status": "success"
      }
    ]
  }
}
```

### Exemplo de Uso

```typescript
const { data, error } = await supabase.functions.invoke('sync-all-accounts', {
  body: {}
});

console.log(`Sincronizadas: ${data.results.synced} contas`);
```

---

## Datawarehouse API

**Path:** `supabase/functions/datawarehouse-api`  
**Autenticação:** Requerida (JWT)  
**Método:** GET, POST

### Descrição

API para exportação e análise de dados do datawarehouse.

### Endpoints

#### GET `/datawarehouse-api?table={table}&format={format}`

Exporta dados de uma tabela específica.

**Parâmetros:**
- `table`: Nome da tabela (prospects, atividades, visits, etc.)
- `format`: Formato de exportação (json, csv, xlsx)
- `startDate`: Data inicial (opcional)
- `endDate`: Data final (opcional)

#### POST `/datawarehouse-api`

Executa queries customizadas (parametrizadas, sem SQL raw).

---

## Photo Analysis Queue

**Path:** `supabase/functions/process-photo-analysis-queue`  
**Autenticação:** Requerida (JWT)  
**Método:** POST

### Descrição

Processa fila de análise de fotos usando IA.

---

## Marketing Insights

**Path:** `supabase/functions/marketing-insights`  
**Autenticação:** Requerida (JWT)  
**Método:** POST

### Descrição

Gera insights de marketing usando IA baseado em dados históricos.

---

## Segurança e CORS

### Headers CORS

Todas as Edge Functions usam CORS restritivo por origem (sem `*`):

```javascript
// _shared/cors.ts — whitelist de origens Lovable + produção
const allowedOrigins = [/lovable\.app$/, /bimaster\.lovable\.app$/];
```

### Criptografia de Tokens OAuth

```typescript
// Fluxo completo (usado em social-media-cron e sync-all-accounts):
// 1. Buscar token encrypted do banco
const { data } = await supabase.from('social_media_accounts')
  .select('access_token_encrypted');

// 2. Decriptar via RPC (chave gerenciada pelo Vault)
const { data: token } = await supabase.rpc('decrypt_token', {
  p_encrypted: account.access_token_encrypted
});

// 3. Usar token para chamar API externa
```

### Security Headers

Todas as respostas incluem:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy`
- `Permissions-Policy`

### Rate Limiting

- 20 req/min para endpoints de IA
- 100 req/min para operacional
- 60 req/min para webhooks
- Customizável via `check_rate_limit()` SQL

### Secrets

Gerenciados via Lovable Cloud:
- `oauth_encryption_key`: Chave dedicada no Vault para criptografia de tokens
- Tokens OAuth: Armazenados criptografados em `social_media_accounts.access_token_encrypted`

---

**Última atualização:** 2026-04-04  
**Versão:** 2.0.0
