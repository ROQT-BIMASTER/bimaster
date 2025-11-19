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

### Request Body

```json
{
  "accountId": "uuid",
  "platform": "instagram" | "facebook" | "tiktok" | "linkedin" | "twitter"
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

Sincroniza todas as contas de redes sociais do usuário autenticado.

### Request Body

```json
{
  "userId": "uuid" // Opcional, usa o usuário autenticado se não fornecido
}
```

### Response

```json
{
  "success": true,
  "synced": 5,
  "failed": 1,
  "results": [
    {
      "accountId": "uuid",
      "platform": "instagram",
      "status": "success"
    }
  ]
}
```

### Exemplo de Uso

```typescript
const { data, error } = await supabase.functions.invoke('sync-all-accounts', {
  body: {}
});

console.log(`Sincronizadas: ${data.synced} contas`);
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

**Response:**

```json
{
  "success": true,
  "data": [...],
  "recordCount": 150,
  "exportedAt": "2025-01-01T12:00:00Z"
}
```

#### POST `/datawarehouse-api`

Executa queries customizadas.

**Request Body:**

```json
{
  "query": {
    "tables": ["prospects", "atividades"],
    "filters": {
      "status": "convertido",
      "dateRange": {
        "start": "2025-01-01",
        "end": "2025-01-31"
      }
    },
    "groupBy": ["regiao", "vendedor_id"],
    "orderBy": "total_vendas DESC"
  }
}
```

### Exemplo de Uso

```typescript
// Exportar prospects
const { data } = await supabase.functions.invoke('datawarehouse-api', {
  body: {
    method: 'GET',
    params: {
      table: 'prospects',
      format: 'json',
      startDate: '2025-01-01'
    }
  }
});

// Query customizada
const { data: analytics } = await supabase.functions.invoke('datawarehouse-api', {
  body: {
    query: {
      tables: ['prospects', 'atividades'],
      filters: { status: 'convertido' }
    }
  }
});
```

---

## Photo Analysis Queue

**Path:** `supabase/functions/process-photo-analysis-queue`  
**Autenticação:** Requerida (JWT)  
**Método:** POST

### Descrição

Processa fila de análise de fotos usando IA (Google Vision API).

### Request Body

```json
{
  "photoId": "uuid",
  "analysisType": "shelf" | "competitor" | "gondola"
}
```

### Response

```json
{
  "success": true,
  "analysis": {
    "products": [...],
    "facings": 5,
    "compliance": 0.85,
    "competitors": [...],
    "recommendations": [...]
  }
}
```

### Exemplo de Uso

```typescript
const { data } = await supabase.functions.invoke('process-photo-analysis-queue', {
  body: {
    photoId: 'photo-uuid',
    analysisType: 'shelf'
  }
});
```

---

## Marketing Insights

**Path:** `supabase/functions/marketing-insights`  
**Autenticação:** Requerida (JWT)  
**Método:** POST

### Descrição

Gera insights de marketing usando IA baseado em dados históricos.

### Request Body

```json
{
  "analysisType": "campaign" | "performance" | "trends",
  "dateRange": {
    "start": "2025-01-01",
    "end": "2025-01-31"
  },
  "platforms": ["instagram", "facebook"]
}
```

### Response

```json
{
  "success": true,
  "insights": [
    {
      "type": "recommendation",
      "priority": "high",
      "title": "Aumentar posts no Instagram",
      "description": "Análise mostra 45% mais engajamento às 18h",
      "expectedImpact": "15-20% de aumento em engajamento"
    }
  ]
}
```

---

## Segurança e CORS

### Headers CORS

Todas as Edge Functions incluem headers CORS:

```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

### Autenticação

A maioria das funções requer autenticação JWT:

```typescript
// Verificação automática via Supabase
const authHeader = req.headers.get('authorization');
const token = authHeader?.replace('Bearer ', '');
```

### Rate Limiting

- **Limit:** 100 requests/minuto por usuário
- **Response:** `429 Too Many Requests`

### Secrets

Secrets são gerenciados via Lovable Cloud Secrets:

- `OPENAI_API_KEY`: Para análise de IA
- `GOOGLE_VISION_API_KEY`: Para análise de fotos
- Tokens de redes sociais: Armazenados em `social_media_accounts`

---

## Monitoramento e Logs

### Acessar Logs

```bash
# Via Lovable Cloud UI
Cloud → Functions → [Nome da Função] → Logs
```

### Log Structure

```typescript
console.log('✅ Success:', { operation, duration, metadata });
console.error('❌ Error:', { operation, error, context });
console.warn('⚠️ Warning:', { message, details });
```

### Métricas

- **Response Time:** < 3s (target)
- **Error Rate:** < 1%
- **Timeout:** 55s (Supabase limit)

---

## Troubleshooting

### Problema: Timeout (55s)

**Causa:** Processamento muito lento  
**Solução:** 
- Quebrar operações em chunks menores
- Usar processamento em background
- Otimizar queries

### Problema: CORS Error

**Causa:** Headers CORS faltando  
**Solução:**
- Verificar OPTIONS handler
- Confirmar headers em todas as responses

### Problema: 401 Unauthorized

**Causa:** Token JWT inválido/expirado  
**Solução:**
- Verificar se usuário está autenticado
- Refresh do token se necessário

---

## Desenvolvimento Local

### Testar Localmente

```bash
# Instalar Supabase CLI
npm install -g supabase

# Iniciar funções localmente
supabase functions serve

# Testar função
curl -i --location --request POST 'http://localhost:54321/functions/v1/social-media-metrics' \
  --header 'Authorization: Bearer YOUR_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{"accountId":"uuid","platform":"instagram"}'
```

### Deploy

As Edge Functions são deployadas automaticamente quando o código é commitado.

---

## Recursos Adicionais

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Deploy](https://deno.com/deploy)
- [Lovable Cloud Documentation](https://docs.lovable.dev/features/cloud)

---

**Última atualização:** 2025-01-19  
**Versão:** 1.0.0
