# Workflow N8N: Sincronização 500.000+ Registros

## Configuração Completa em Uma Única Mensagem

---

## 1. HEADERS OBRIGATÓRIOS (Para TODAS as requisições)

```
Content-Type: application/json
x-api-key: N8N_API_KEY_CONFIGURADA_NO_SUPABASE
```

> **IMPORTANTE**: A `x-api-key` deve ser a mesma configurada nas Secrets do Supabase

---

## 2. ESTRUTURA DO WORKFLOW

```
┌─────────────────┐
│  1. Schedule    │ (Cron: 0 2 * * * = 02:00 diário)
│     Trigger     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  2. HTTP POST   │ → sync-start
│  Iniciar Sync   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  3. Loop        │ ← Máx 200 iterações
│  (While hasMore)│
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         │
┌─────────────────┐
│ 3a. HTTP POST   │ → Webhook N8N (busca ERP)
│ Buscar Página   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3b. HTTP POST   │ → sync-page (envia ao Supabase)
│ Enviar Dados    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3c. Wait 2s     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3d. IF hasMore  │──── false ────┐
│     = true?     │               │
└────────┬────────┘               │
         │ true                   │
         └───────────────────┐    │
                             │    │
                             ▼    ▼
                      ┌─────────────────┐
                      │  4. HTTP POST   │ → sync-finish
                      │  Finalizar      │
                      └─────────────────┘
```

---

## 3. CONFIGURAÇÃO NODE POR NODE

### NODE 1: Schedule Trigger

```json
{
  "parameters": {
    "rule": {
      "interval": [
        {
          "triggerAtHour": 2,
          "triggerAtMinute": 0
        }
      ]
    }
  },
  "name": "Trigger Diário 02:00",
  "type": "n8n-nodes-base.scheduleTrigger",
  "position": [250, 300]
}
```

**Configuração Manual:**
- Type: Schedule Trigger
- Trigger Times: Daily at 2:00 AM
- Timezone: America/Sao_Paulo

---

### NODE 2: HTTP Request - Sync Start

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/n8n-contas-receber/sync-start",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Content-Type",
          "value": "application/json"
        },
        {
          "name": "x-api-key",
          "value": "={{ $env.N8N_API_KEY }}"
        }
      ]
    },
    "sendBody": true,
    "bodyParameters": {
      "parameters": [
        {
          "name": "batchSize",
          "value": "5000"
        },
        {
          "name": "scope",
          "value": "full"
        }
      ]
    },
    "options": {
      "timeout": 60000
    }
  },
  "name": "Iniciar Sincronização",
  "type": "n8n-nodes-base.httpRequest",
  "position": [450, 300]
}
```

**Configuração Manual:**
- Method: POST
- URL: `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/n8n-contas-receber/sync-start`
- Headers:
  - `Content-Type`: `application/json`
  - `x-api-key`: `{{ $env.N8N_API_KEY }}`
- Body (JSON):
```json
{
  "batchSize": 5000,
  "scope": "full"
}
```
- Timeout: 60000ms

**Response esperada:**
```json
{
  "success": true,
  "syncId": "abc123-uuid",
  "message": "Sync started"
}
```

---

### NODE 3: Loop Over Items

```json
{
  "parameters": {
    "options": {
      "reset": false
    }
  },
  "name": "Loop Páginas",
  "type": "n8n-nodes-base.splitInBatches",
  "position": [650, 300]
}
```

**Configuração Alternativa - Loop Node:**
- Use: "Loop Over Items" ou "Split In Batches"
- Max Iterations: 200 (para 500k registros / 2500 por página)

---

### NODE 3a: HTTP Request - Buscar Página ERP

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://huggs.app.n8n.cloud/webhook/contas-receber-mcp",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ limit: 2500, offset: $runIndex * 2500 }) }}",
    "options": {
      "timeout": 120000,
      "retry": {
        "maxTries": 3,
        "retryInterval": 5000
      }
    }
  },
  "name": "Buscar Dados ERP",
  "type": "n8n-nodes-base.httpRequest",
  "position": [850, 300]
}
```

**Configuração Manual:**
- Method: POST
- URL: `https://huggs.app.n8n.cloud/webhook/contas-receber-mcp`
- Headers:
  - `Content-Type`: `application/json`
- Body (JSON):
```json
{
  "limit": 2500,
  "offset": {{ $runIndex * 2500 }}
}
```
- Timeout: 120000ms (2 minutos)
- Retry on Fail: Yes
- Max Retries: 3
- Retry Interval: 5000ms

**Response esperada:**
```json
{
  "metadata": {
    "recordsReturned": 2500,
    "offset": 0,
    "limit": 2500,
    "hasMoreData": true,
    "nextOffset": 2500
  },
  "data": [
    {
      "ID Empresa": 1,
      "Empresa": "EMPRESA TESTE",
      "Tipo": "NF",
      "Nota": "12345",
      "Seq": 1,
      "Código": "1001",
      "Cliente": "CLIENTE EXEMPLO",
      "Valor_Trc": 1500.00,
      "Valor em Aberto": 500.00,
      "Valor Pago": 1000.00,
      "Emissão": "2024-01-15",
      "Vencimento": "2024-02-15",
      "Data Pgto": "2024-02-10"
    }
  ]
}
```

---

### NODE 3b: HTTP Request - Enviar ao Supabase

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/n8n-contas-receber/sync-page",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Content-Type",
          "value": "application/json"
        },
        {
          "name": "x-api-key",
          "value": "={{ $env.N8N_API_KEY }}"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ syncId: $('Iniciar Sincronização').item.json.syncId, offset: $runIndex * 2500, batchSize: 2500, data: $json.data }) }}",
    "options": {
      "timeout": 180000,
      "retry": {
        "maxTries": 5,
        "retryInterval": 10000
      }
    }
  },
  "name": "Enviar ao Supabase",
  "type": "n8n-nodes-base.httpRequest",
  "position": [1050, 300]
}
```

**Configuração Manual:**
- Method: POST
- URL: `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/n8n-contas-receber/sync-page`
- Headers:
  - `Content-Type`: `application/json`
  - `x-api-key`: `{{ $env.N8N_API_KEY }}`
- Body (JSON):
```json
{
  "syncId": "{{ $('Iniciar Sincronização').item.json.syncId }}",
  "offset": {{ $runIndex * 2500 }},
  "batchSize": 2500,
  "data": {{ $json.data }}
}
```
- Timeout: 180000ms (3 minutos)
- Retry on Fail: Yes
- Max Retries: 5
- Retry Interval: 10000ms

---

### NODE 3c: Wait

```json
{
  "parameters": {
    "amount": 2,
    "unit": "seconds"
  },
  "name": "Aguardar 2s",
  "type": "n8n-nodes-base.wait",
  "position": [1250, 300]
}
```

---

### NODE 3d: IF - Verificar hasMore

```json
{
  "parameters": {
    "conditions": {
      "boolean": [
        {
          "value1": "={{ $('Buscar Dados ERP').item.json.metadata.hasMoreData }}",
          "value2": true
        }
      ]
    }
  },
  "name": "Tem Mais Dados?",
  "type": "n8n-nodes-base.if",
  "position": [1450, 300]
}
```

**Configuração Manual:**
- Condition: `{{ $('Buscar Dados ERP').item.json.metadata.hasMoreData }}` equals `true`
- True → Volta para NODE 3a (Loop)
- False → Vai para NODE 4

---

### NODE 4: HTTP Request - Finalizar

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/n8n-contas-receber/sync-finish",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Content-Type",
          "value": "application/json"
        },
        {
          "name": "x-api-key",
          "value": "={{ $env.N8N_API_KEY }}"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ syncId: $('Iniciar Sincronização').item.json.syncId, totalProcessed: $runIndex * 2500, status: 'completed' }) }}",
    "options": {
      "timeout": 60000
    }
  },
  "name": "Finalizar Sincronização",
  "type": "n8n-nodes-base.httpRequest",
  "position": [1650, 300]
}
```

**Configuração Manual:**
- Method: POST
- URL: `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/n8n-contas-receber/sync-finish`
- Headers:
  - `Content-Type`: `application/json`
  - `x-api-key`: `{{ $env.N8N_API_KEY }}`
- Body (JSON):
```json
{
  "syncId": "{{ $('Iniciar Sincronização').item.json.syncId }}",
  "totalProcessed": {{ $runIndex * 2500 }},
  "status": "completed"
}
```

---

## 4. VARIÁVEIS DE AMBIENTE N8N

Configure estas variáveis em **Settings → Variables**:

| Variável | Valor |
|----------|-------|
| `N8N_API_KEY` | Sua chave API (mesma do Supabase Secrets) |

---

## 5. WORKFLOW JSON COMPLETO (Importar Direto)

```json
{
  "name": "Sync Contas Receber 500k",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [{"triggerAtHour": 2}]
        }
      },
      "name": "Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "position": [250, 300],
      "typeVersion": 1
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/n8n-contas-receber/sync-start",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {"name": "Content-Type", "value": "application/json"},
            {"name": "x-api-key", "value": "={{ $env.N8N_API_KEY }}"}
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {"name": "batchSize", "value": "2500"},
            {"name": "scope", "value": "full"}
          ]
        }
      },
      "name": "Sync Start",
      "type": "n8n-nodes-base.httpRequest",
      "position": [450, 300],
      "typeVersion": 4
    },
    {
      "parameters": {
        "options": {}
      },
      "name": "Loop",
      "type": "n8n-nodes-base.splitInBatches",
      "position": [650, 300],
      "typeVersion": 3
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://huggs.app.n8n.cloud/webhook/contas-receber-mcp",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ limit: 2500, offset: $runIndex * 2500 }) }}",
        "options": {"timeout": 120000}
      },
      "name": "Fetch ERP",
      "type": "n8n-nodes-base.httpRequest",
      "position": [850, 300],
      "typeVersion": 4
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/n8n-contas-receber/sync-page",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {"name": "Content-Type", "value": "application/json"},
            {"name": "x-api-key", "value": "={{ $env.N8N_API_KEY }}"}
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ syncId: $('Sync Start').item.json.syncId, offset: $runIndex * 2500, data: $json.data }) }}",
        "options": {"timeout": 180000}
      },
      "name": "Sync Page",
      "type": "n8n-nodes-base.httpRequest",
      "position": [1050, 300],
      "typeVersion": 4
    },
    {
      "parameters": {
        "amount": 2,
        "unit": "seconds"
      },
      "name": "Wait",
      "type": "n8n-nodes-base.wait",
      "position": [1250, 300],
      "typeVersion": 1
    },
    {
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{ $('Fetch ERP').item.json.metadata.hasMoreData }}",
              "value2": true
            }
          ]
        }
      },
      "name": "Has More?",
      "type": "n8n-nodes-base.if",
      "position": [1450, 300],
      "typeVersion": 1
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/n8n-contas-receber/sync-finish",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {"name": "Content-Type", "value": "application/json"},
            {"name": "x-api-key", "value": "={{ $env.N8N_API_KEY }}"}
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ syncId: $('Sync Start').item.json.syncId, totalProcessed: $runIndex * 2500 }) }}"
      },
      "name": "Sync Finish",
      "type": "n8n-nodes-base.httpRequest",
      "position": [1650, 300],
      "typeVersion": 4
    }
  ],
  "connections": {
    "Trigger": {"main": [[{"node": "Sync Start", "type": "main", "index": 0}]]},
    "Sync Start": {"main": [[{"node": "Loop", "type": "main", "index": 0}]]},
    "Loop": {"main": [[{"node": "Fetch ERP", "type": "main", "index": 0}]]},
    "Fetch ERP": {"main": [[{"node": "Sync Page", "type": "main", "index": 0}]]},
    "Sync Page": {"main": [[{"node": "Wait", "type": "main", "index": 0}]]},
    "Wait": {"main": [[{"node": "Has More?", "type": "main", "index": 0}]]},
    "Has More?": {
      "main": [
        [{"node": "Loop", "type": "main", "index": 0}],
        [{"node": "Sync Finish", "type": "main", "index": 0}]
      ]
    }
  }
}
```

---

## 6. ENDPOINTS SUPABASE

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/sync-start` | POST | Inicia sincronização, retorna syncId |
| `/sync-page` | POST | Processa uma página de dados |
| `/sync-finish` | POST | Finaliza e gera relatório |
| `/sync-status` | GET | Consulta status atual |

**URL Base:** `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/n8n-contas-receber`

---

## 7. ESTIMATIVA DE TEMPO

| Registros | Páginas (2500/pág) | Tempo Estimado |
|-----------|-------------------|----------------|
| 100.000 | 40 | ~5 min |
| 250.000 | 100 | ~12 min |
| 500.000 | 200 | ~25 min |
| 1.000.000 | 400 | ~50 min |

---

## 8. TROUBLESHOOTING

### Erro: Timeout
- Reduza `limit` para 1000
- Aumente timeout para 300000ms

### Erro: Rate Limit
- Aumente Wait para 5 segundos
- Reduza `limit` para 1000

### Erro: Dados não aparecem no Supabase
- Verifique se `x-api-key` está correta
- Consulte logs: `sync-status?syncId=xxx`

---

## 9. MONITORAMENTO

### Consultar progresso:
```
GET https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/n8n-contas-receber/sync-status
Headers: x-api-key: SUA_API_KEY
```

### SQL para verificar dados:
```sql
SELECT COUNT(*) FROM contas_receber;
SELECT * FROM contas_receber ORDER BY sincronizado_em DESC LIMIT 10;
```

---

## 10. CONFIGURAÇÃO API KEY

A API Key deve estar configurada em DOIS lugares:

1. **Supabase Secrets** (já deve estar configurada)
2. **N8N Variables**: Settings → Variables → Adicionar `N8N_API_KEY`

Use a mesma chave em ambos os lugares.

---

**Pronto!** Copie o JSON do workflow (seção 5) e importe no N8N via: Workflows → Import from File/URL → Paste JSON
