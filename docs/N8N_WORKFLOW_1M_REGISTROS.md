# Configuração N8N para 1 Milhão+ de Registros

## Visão Geral

Este documento descreve como configurar o workflow N8N para sincronizar 1 milhão+ de registros de Contas a Receber de forma eficiente.

## Estratégia de Sincronização

### Cronograma Recomendado

| Horário | Tipo | Volume Esperado | Endpoint |
|---------|------|-----------------|----------|
| 02:00 | Full Sync | ~1M registros | `/bulk-sync` |
| 08:00 | Incremental | ~20k alterados | `/sync-incremental` |
| 14:00 | Incremental | ~30k alterados | `/sync-incremental` |
| 20:00 | Incremental | ~15k alterados | `/sync-incremental` |

## Configurações Otimizadas

### Parâmetros de Performance

| Parâmetro | Valor Otimizado | Descrição |
|-----------|-----------------|-----------|
| Chunk Size | 25.000 | Registros por request |
| Batch Size (SQL) | 10.000 | Registros por batch interno |
| Timeout | 180s | Tempo máximo por request |
| Delay entre chunks | 2s | Pausa entre requests |
| Retries | 5 | Tentativas com backoff |

### Performance Esperada

| Cenário | Chunks | Tempo Estimado | Taxa |
|---------|--------|----------------|------|
| Incremental (50k) | 2 | 30-60s | ~1.500 rec/s |
| Incremental 6h (10k) | 1 | 15-30s | ~500 rec/s |
| Full sync (1M) | 40 | 12-15min | ~1.200 rec/s |
| Full inicial (1.5M) | 60 | 18-22min | ~1.100 rec/s |

## Workflow N8N: Sync Completa (1x/dia)

### 1. Trigger (Schedule)

```
Cron: 0 2 * * *
Timezone: America/Sao_Paulo
```

### 2. SQL Query (ERP)

```sql
SELECT 
  [ID Empresa],
  [Empresa],
  [Tipo],
  [Nota],
  [Seq],
  [Código],
  [Cliente],
  [Valor_Trc],
  [Valor em Aberto],
  [Valor Pago],
  [Valor Juros],
  [Valor Desconto],
  [Valor Ajustes],
  [Emissão],
  [Vencimento],
  [Pigto de dados],
  [Tabela],
  [Vendedor],
  [Cód Vendedor],
  [ID Portador],
  [Nome Portador],
  [Conta]
FROM vw_contas_receber
WHERE [Vencimento] >= DATEADD(YEAR, -2, GETDATE())
ORDER BY [ID Empresa], [Tipo], [Nota], [Seq]
```

### 3. Split In Batches

```json
{
  "batchSize": 25000,
  "options": {
    "reset": true
  }
}
```

### 4. HTTP Request - /bulk-sync

```yaml
Method: POST
URL: https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-receber-api/bulk-sync
Headers:
  Content-Type: application/json
  x-api-key: {{ $env.N8N_API_KEY }}
Body:
  contas: {{ $json }}
Timeout: 180000
Retry on Fail: true
Max Retries: 5
Retry Interval: 5000
```

### 5. Wait Node

```json
{
  "amount": 2,
  "unit": "seconds"
}
```

### 6. Error Handler (IF)

```
Condition: {{ $json.success === false }}
True: Send Alert (Email/Slack)
False: Continue
```

### 7. Finalização - /sync-complete

```yaml
Method: POST
URL: https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-receber-api/sync-complete
Body:
  empresa_id: 1
  total_chunks: {{ $runIndex }}
  total_registros: {{ $items.length }}
  duracao_total_ms: {{ $now.toMillis() - $workflow.startedAt.toMillis() }}
```

---

## Workflow N8N: Sync Incremental (4x/dia)

### 1. Trigger (Schedule)

```
Cron: 0 8,14,20 * * *
Timezone: America/Sao_Paulo
```

### 2. SQL Query (Alterados nas últimas 6h)

```sql
SELECT *
FROM vw_contas_receber
WHERE data_modificacao >= DATEADD(HOUR, -6, GETDATE())
   OR data_pagamento >= DATEADD(HOUR, -6, GETDATE())
ORDER BY [ID Empresa], [Tipo], [Nota], [Seq]
```

### 3. HTTP Request - /sync-incremental

```yaml
Method: POST
URL: https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-receber-api/sync-incremental
Headers:
  Content-Type: application/json
  x-api-key: {{ $env.N8N_API_KEY }}
Body:
  contas: {{ $json }}
  skip_unchanged: true
Timeout: 180000
```

A vantagem do endpoint incremental:
- Compara hash dos dados antes de atualizar
- Ignora registros sem alteração
- Retorna estatísticas de: novos, atualizados, ignorados

---

## Endpoints Disponíveis

### POST /bulk-sync
Carga massiva otimizada para grandes volumes.

**Request:**
```json
{
  "contas": [...] // até 100.000 registros
}
```

**Response:**
```json
{
  "success": true,
  "mode": "bulk_sql",
  "statistics": {
    "total": 25000,
    "processed": 24950,
    "errors": 50,
    "rate_per_second": 1250
  },
  "duration_ms": 20000
}
```

### POST /sync-incremental
Sincronização inteligente que ignora registros não alterados.

**Request:**
```json
{
  "contas": [...],
  "skip_unchanged": true
}
```

**Response:**
```json
{
  "success": true,
  "mode": "incremental",
  "sync_id": "uuid",
  "statistics": {
    "total_received": 10000,
    "processed": 3500,
    "inserted": 500,
    "updated": 3000,
    "skipped": 6500,
    "errors": 0,
    "rate_per_second": 875
  },
  "duration_ms": 4000
}
```

### GET /last-sync
Consulta último timestamp de sincronização.

**Query params:**
- `tipo`: 'full' ou 'incremental'

**Response:**
```json
{
  "last_sync_timestamp": "2024-01-15T02:00:00Z",
  "tipo": "full",
  "history": [...]
}
```

---

## Monitoramento

### Consultar Progresso em Tempo Real

```sql
SELECT 
  entidade,
  tipo_sync,
  status,
  records_processed,
  records_skipped,
  duration_ms,
  last_sync_at
FROM sync_tracking
WHERE entidade = 'contas_receber'
ORDER BY created_at DESC
LIMIT 10;
```

### Resumo das Últimas Sincronizações

```sql
SELECT * FROM sync_tracking_summary
WHERE entidade = 'contas_receber';
```

---

## Troubleshooting

### Timeout em chunks grandes
- Reduza o chunk size para 15.000
- Aumente o timeout para 300s

### Muitos erros de deadlock
- Aumente o delay entre chunks para 5s
- Verifique se há outras operações concorrentes

### Sync incremental muito lenta
- Verifique se a query SQL tem índice em `data_modificacao`
- Considere particionar a tabela no ERP

### Memória insuficiente no N8N
- Reduza o chunk size para 10.000
- Ative streaming no node SQL

---

## Headers Obrigatórios

```
Content-Type: application/json
x-api-key: [N8N_API_KEY configurada nas secrets]
```

---

## Benefícios da Arquitetura

1. **10x mais rápido** - De ~2h para ~15min para 1M registros
2. **Incremental inteligente** - Economiza 90%+ do tempo
3. **Resiliente** - 5 retries com backoff exponencial
4. **Monitorável** - Rastreamento completo com ETA
5. **Escalável** - Pronto para 2M+ registros
6. **Menor carga** - Menos requests, menos overhead
