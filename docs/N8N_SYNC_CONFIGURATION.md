# Configuração N8N - Sincronização de Contas a Receber

Este documento descreve como configurar o workflow N8N para sincronizar 400.000+ registros de contas a receber de forma eficiente usando chunking inteligente.

## Visão Geral

O sistema usa uma abordagem de **chunking inteligente** para processar grandes volumes de dados:

- **Chunk Size**: 5.000 registros por chunk
- **Delay entre chunks**: 3 segundos
- **Retry automático**: 3 tentativas com backoff exponencial
- **Rastreamento**: Cada chunk é logado para monitoramento

## Diagrama do Workflow

```
┌─────────────┐     ┌──────────────┐     ┌───────────────────┐
│   Trigger   │────▶│  SQL Query   │────▶│ Split In Batches  │
│   (Cron)    │     │  (ERP Data)  │     │    (5000 rec)     │
└─────────────┘     └──────────────┘     └─────────┬─────────┘
                                                   │
                    ┌──────────────────────────────┘
                    ▼
        ┌───────────────────────┐
        │   Para cada chunk:    │
        │  ┌─────────────────┐  │
        │  │ HTTP POST       │  │
        │  │ /sync-chunk     │  │
        │  └────────┬────────┘  │
        │           │           │
        │  ┌────────▼────────┐  │
        │  │ Wait 3 seconds  │  │
        │  └────────┬────────┘  │
        │           │           │
        │  ┌────────▼────────┐  │
        │  │ IF: Erro?       │──┼──▶ Retry (max 3x)
        │  │ → Log & Continue│  │
        │  └─────────────────┘  │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ HTTP POST             │
        │ /sync-complete        │
        └───────────────────────┘
```

## Endpoints Disponíveis

### 1. GET /sync-status
Consultar status da última sincronização.

```json
// Request
GET /functions/v1/contas-receber-api/sync-status?empresa_id=1

// Response
{
  "last_sync": {
    "ultima_sync": "2024-01-15T10:30:00Z",
    "total_registros": 400000,
    "status": "complete"
  },
  "recent_chunks": [...],
  "recommended_chunk_size": 5000
}
```

### 2. POST /sync-start (Opcional)
Iniciar nova sincronização com tracking.

```json
// Request
POST /functions/v1/contas-receber-api/sync-start
{
  "empresa_id": 1,
  "total_records": 400000,
  "total_chunks": 80
}

// Response
{
  "success": true,
  "sync_id": "abc123",
  "message": "Sync iniciada: 400000 registros em 80 chunks",
  "recommended_delay_between_chunks_ms": 3000
}
```

### 3. POST /sync-chunk
Processar um chunk de dados.

```json
// Request
POST /functions/v1/contas-receber-api/sync-chunk
{
  "contas": [...],           // Array de até 5000 registros
  "chunk_id": 1,             // Número do chunk (1-indexed)
  "total_chunks": 80,        // Total de chunks
  "sync_id": "abc123",       // ID da sync (opcional)
  "empresa_id": 1            // ID da empresa (opcional)
}

// Response
{
  "success": true,
  "chunk_id": 1,
  "total_chunks": 80,
  "statistics": {
    "received": 5000,
    "processed": 5000,
    "errors": 0,
    "rate_per_second": 166
  },
  "duration_ms": 30000,
  "next_action": "continue",
  "message": "Chunk 1 OK. Aguarde 3s antes do próximo chunk."
}
```

### 4. POST /sync-complete
Finalizar sincronização.

```json
// Request
POST /functions/v1/contas-receber-api/sync-complete
{
  "empresa_id": 1,
  "sync_id": "abc123",
  "total_chunks": 80,
  "total_registros": 400000,
  "duracao_total_ms": 2400000
}

// Response
{
  "success": true,
  "summary": {
    "total_chunks": 80,
    "total_records": 400000,
    "total_processed": 399850,
    "total_errors": 150,
    "duration_ms": 2400000,
    "rate_per_second": 166
  }
}
```

### 5. GET /chunks-progress
Consultar progresso dos chunks.

```json
// Request
GET /functions/v1/contas-receber-api/chunks-progress?hours=24

// Response
{
  "data": [...],
  "summary": {
    "total_chunks": 80,
    "total_processed": 400000,
    "total_errors": 0,
    "avg_duration_ms": 30000
  }
}
```

## Configuração Passo a Passo do N8N

### 1. Nó Trigger (Schedule/Cron)
```
- Expression: 0 2 * * * (diariamente às 2h)
- Timezone: America/Sao_Paulo
```

### 2. Nó SQL Query (PostgreSQL/MySQL)
```sql
SELECT 
  "ID Empresa",
  "Empresa",
  "Tipo",
  "Nota",
  "Seq",
  "Código",
  "Cliente",
  "Valor_Trc",
  "Valor em Aberto",
  "Valor Pago",
  "Valor Juros",
  "Valor Desconto",
  "Valor Ajustes",
  "Emissão",
  "Vencimento",
  "Pigto de dados",
  "Tabela",
  "Vendedor",
  "Cód Vendedor",
  "ID Portador",
  "Nome Portador",
  "Conta"
FROM vw_contas_receber
WHERE data_modificacao > '{{ $now.minus(1, 'day').toISO() }}'
   OR data_vencimento >= CURRENT_DATE - INTERVAL '90 days'
```

### 3. Nó Split In Batches
```json
{
  "batchSize": 5000,
  "options": {
    "reset": false
  }
}
```

### 4. Nó HTTP Request (Sync Chunk)
```json
{
  "method": "POST",
  "url": "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-receber-api/sync-chunk",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "x-api-key",
        "value": "={{ $env.N8N_API_KEY }}"
      },
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "bodyParameters": {
    "parameters": [
      {
        "name": "contas",
        "value": "={{ $json }}"
      },
      {
        "name": "chunk_id",
        "value": "={{ $runIndex + 1 }}"
      },
      {
        "name": "total_chunks",
        "value": "={{ Math.ceil($node['SQL Query'].context.noItemsLeft ? $runIndex + 1 : $items('SQL Query').length / 5000) }}"
      }
    ]
  },
  "options": {
    "timeout": 60000,
    "retry": {
      "enabled": true,
      "maxRetries": 3,
      "retryInterval": 5000,
      "retryOnStatusCodes": [429, 500, 502, 503, 504]
    }
  }
}
```

### 5. Nó Wait
```json
{
  "unit": "seconds",
  "amount": 3
}
```

### 6. Nó IF (Verificar Erros)
```
Condition: {{ $json.success === false }}
True branch: Log erro e continuar
False branch: Próximo chunk
```

### 7. Nó HTTP Request (Sync Complete)
```json
{
  "method": "POST",
  "url": "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-receber-api/sync-complete",
  "sendBody": true,
  "bodyParameters": {
    "parameters": [
      {
        "name": "total_chunks",
        "value": "={{ $runIndex + 1 }}"
      },
      {
        "name": "total_registros",
        "value": "={{ $items('SQL Query').length }}"
      },
      {
        "name": "duracao_total_ms",
        "value": "={{ Date.now() - $node['Trigger'].context.startTime }}"
      }
    ]
  }
}
```

## Troubleshooting

### Problema: Timeout nos chunks

**Sintoma**: Chunks falhando com erro de timeout (504)

**Solução**:
1. Reduza o `batchSize` de 5000 para 2500
2. Aumente o delay entre chunks de 3s para 5s
3. Verifique se não há outros processos pesados no banco

### Problema: Deadlock detectado

**Sintoma**: Erro "deadlock detected" ou "could not serialize access"

**Solução**:
1. O sistema já possui retry automático para deadlocks
2. Se persistir, aumente o delay entre chunks para 5s
3. Certifique-se de enviar chunks sequencialmente (não em paralelo)

### Problema: Memória N8N esgotada

**Sintoma**: N8N travando ou reiniciando

**Solução**:
1. Use o nó "Split In Batches" para processar dados em lotes
2. Não carregue todos os 400k registros na memória de uma vez
3. Use streaming do banco de dados se disponível

### Problema: Chunks falhando intermitentemente

**Sintoma**: Alguns chunks falham aleatoriamente

**Solução**:
1. Verifique os logs em `/chunks-progress`
2. O sistema possui retry automático (3x)
3. Chunks com erro são logados para reprocessamento manual

## Métricas de Performance Esperadas

| Métrica | Valor Esperado |
|---------|----------------|
| Registros por segundo | 150-200 |
| Tempo por chunk (5k) | 25-35 segundos |
| Tempo total (400k) | 35-45 minutos |
| Taxa de sucesso | > 99.5% |
| Memory usage N8N | < 1GB |

## Monitoramento

### Consultar progresso em tempo real
```sql
SELECT 
  chunk_id,
  total_chunks,
  registros_processados,
  erros,
  duracao_ms,
  status,
  created_at
FROM sync_chunks_log
WHERE entidade = 'contas_receber'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

### Resumo da última sync
```sql
SELECT 
  entidade,
  ultima_sync,
  total_registros,
  registros_inseridos,
  duracao_ms,
  status
FROM sync_control
WHERE entidade = 'contas_receber'
ORDER BY created_at DESC
LIMIT 1;
```

## Headers de Autenticação

Todos os endpoints requerem autenticação via header `x-api-key`:

```
x-api-key: cr_sync_2024_f7k9Lm3nPqRs8tUv
Content-Type: application/json
```

## Contato

Para suporte técnico ou dúvidas sobre a integração, entre em contato com a equipe de desenvolvimento.
