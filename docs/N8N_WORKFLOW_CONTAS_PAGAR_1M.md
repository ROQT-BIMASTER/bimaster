# Workflow N8N - Contas a Pagar (1M+ Registros)

Configuração otimizada para sincronização de mais de 1 milhão de registros de Contas a Pagar.

## 📊 Arquitetura Recomendada

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WORKFLOW CONTAS A PAGAR                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────┐    ┌───────────┐    ┌──────────────────────────┐    │
│   │  Trigger │───▶│ SQL Query │───▶│ Split In Batches (25k)   │    │
│   │ (Cron)   │    │   (ERP)   │    └──────────────────────────┘    │
│   └──────────┘    └───────────┘              │                     │
│                                              ▼                     │
│   ┌──────────────────────────────────────────────────────────┐    │
│   │                    Para cada chunk:                       │    │
│   │  ┌─────────────┐    ┌──────┐    ┌─────────────────────┐  │    │
│   │  │ HTTP POST   │───▶│ Wait │───▶│ Retry se necessário │  │    │
│   │  │ /bulk-sync  │    │ 2-3s │    └─────────────────────┘  │    │
│   │  └─────────────┘    └──────┘                              │    │
│   └──────────────────────────────────────────────────────────┘    │
│                                              │                     │
│                                              ▼                     │
│   ┌──────────────────────────────────────────────────────────┐    │
│   │                  POST /sync-complete                      │    │
│   └──────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## ⚙️ Configurações de Performance

### Parâmetros Recomendados

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| **Chunk Size** | 25.000 | Registros por requisição |
| **Timeout** | 180s | Timeout da requisição HTTP |
| **Delay entre chunks** | 2-3s | Pausa entre requisições |
| **Max Retries** | 5 | Tentativas em caso de erro |
| **Retry Interval** | 5000ms | Intervalo inicial de retry |

### Performance Esperada

| Cenário | Registros | Tempo Estimado |
|---------|-----------|----------------|
| **Incremental** | 10.000 | ~10 segundos |
| **Incremental** | 50.000 | ~45 segundos |
| **Full Sync** | 500.000 | ~8 minutos |
| **Full Sync** | 1.000.000 | ~15 minutos |

## 📅 Cronograma de Sincronização

```
┌────────────────────────────────────────────────────────────┐
│                    AGENDA DIÁRIA                            │
├──────────┬─────────────────────────────────────────────────┤
│ 02:00 AM │ Full Sync - Carga completa                      │
├──────────┼─────────────────────────────────────────────────┤
│ 08:00 AM │ Incremental - Últimas 6 horas                   │
├──────────┼─────────────────────────────────────────────────┤
│ 14:00 PM │ Incremental - Últimas 6 horas                   │
├──────────┼─────────────────────────────────────────────────┤
│ 20:00 PM │ Incremental - Últimas 6 horas                   │
└──────────┴─────────────────────────────────────────────────┘
```

## 🔌 Endpoints Disponíveis

### POST /bulk-sync
Sincronização em massa (recomendado para N8N).

**Request:**
```json
{
  "sync_id": "uuid-do-sync",
  "chunk_number": 1,
  "total_chunks": 40,
  "contas": [
    {
      "ID Empresa": 1,
      "Empresa": "MATRIZ",
      "Tipo": "NF",
      "Nota": "123456",
      "Seq": 1,
      "Código": "FORN001",
      "Cliente": "Fornecedor ABC",
      "Valor_Trc": 1500.00,
      "Valor em Aberto": 1500.00,
      "Valor Pago": 0,
      "Valor Juros": 0,
      "Valor Desconto": 0,
      "Valor Ajustes": 0,
      "Emissão": "2024-01-15",
      "Vencimento": "2024-02-15",
      "Data Pgto": null,
      "ID Historico": "MAT",
      "Historico": "MATERIA PRIMA",
      "Portador": "BANCO BRASIL",
      "Conta": "12345-6"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "sync_id": "uuid-do-sync",
  "chunk_number": 1,
  "statistics": {
    "total_received": 25000,
    "inserted": 5000,
    "updated": 3000,
    "skipped": 17000,
    "errors": 0
  },
  "duration_ms": 1250,
  "performance": {
    "records_per_second": 20000
  }
}
```

### POST /sync-incremental
Para sincronizações incrementais (mudanças recentes).

**Request:**
```json
{
  "contas": [/* array de contas alteradas */]
}
```

### POST /sync-complete
Finaliza a sincronização e consolida estatísticas.

**Request:**
```json
{
  "sync_id": "uuid-do-sync",
  "empresa_id": 1
}
```

### GET /chunks-progress
Consultar progresso dos chunks.

**Query params:** `?sync_id=uuid-do-sync`

## 📋 Configuração N8N

### 1. Schedule Trigger
```json
{
  "rule": "0 2 * * *",
  "timezone": "America/Sao_Paulo"
}
```

### 2. SQL Server Query (Full Sync)
```sql
SELECT 
    E.ID_EMPRESA AS [ID Empresa],
    E.NOME AS [Empresa],
    CP.TIPO AS [Tipo],
    CP.NUMERO_NOTA AS [Nota],
    CP.SEQUENCIA AS [Seq],
    F.CODIGO AS [Código],
    F.RAZAO_SOCIAL AS [Cliente],
    CP.VALOR_ORIGINAL AS [Valor_Trc],
    CP.VALOR_ABERTO AS [Valor em Aberto],
    CP.VALOR_PAGO AS [Valor Pago],
    CP.VALOR_JUROS AS [Valor Juros],
    CP.VALOR_DESCONTO AS [Valor Desconto],
    CP.VALOR_AJUSTES AS [Valor Ajustes],
    CP.DATA_EMISSAO AS [Emissão],
    CP.DATA_VENCIMENTO AS [Vencimento],
    CP.DATA_PAGAMENTO AS [Data Pgto],
    H.CODIGO AS [ID Historico],
    H.DESCRICAO AS [Historico],
    P.NOME AS [Portador],
    C.NUMERO AS [Conta]
FROM CONTAS_PAGAR CP
    INNER JOIN EMPRESAS E ON CP.ID_EMPRESA = E.ID_EMPRESA
    LEFT JOIN FORNECEDORES F ON CP.ID_FORNECEDOR = F.ID_FORNECEDOR
    LEFT JOIN HISTORICOS H ON CP.ID_HISTORICO = H.ID_HISTORICO
    LEFT JOIN PORTADORES P ON CP.ID_PORTADOR = P.ID_PORTADOR
    LEFT JOIN CONTAS C ON CP.ID_CONTA = C.ID_CONTA
WHERE CP.DATA_EMISSAO >= DATEADD(YEAR, -2, GETDATE())
ORDER BY CP.DATA_VENCIMENTO DESC
```

### 3. SQL Server Query (Incremental)
```sql
SELECT /* mesmos campos */
FROM CONTAS_PAGAR CP
    /* mesmos JOINs */
WHERE CP.DATA_MODIFICACAO >= DATEADD(HOUR, -6, GETDATE())
   OR CP.DATA_PAGAMENTO >= DATEADD(HOUR, -6, GETDATE())
ORDER BY CP.DATA_VENCIMENTO DESC
```

### 4. Split In Batches
```json
{
  "batchSize": 25000,
  "options": {}
}
```

### 5. HTTP Request (bulk-sync)
```json
{
  "method": "POST",
  "url": "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-pagar-api/bulk-sync",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "options": {
    "timeout": 180000,
    "retry": {
      "enabled": true,
      "maxTries": 5,
      "retryInterval": 5000,
      "retryIntervalMultiplier": 2
    }
  },
  "headers": {
    "Content-Type": "application/json",
    "x-api-key": "{{ $credentials.apiKey }}"
  },
  "body": {
    "sync_id": "{{ $runIndex === 0 ? $now.toISOString() : $('Set sync_id').item.json.sync_id }}",
    "chunk_number": "{{ $runIndex + 1 }}",
    "total_chunks": "{{ Math.ceil($('SQL Query').length / 25000) }}",
    "contas": "{{ $json }}"
  }
}
```

### 6. Wait Node
```json
{
  "amount": 2,
  "unit": "seconds"
}
```

### 7. HTTP Request (sync-complete)
```json
{
  "method": "POST",
  "url": "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-pagar-api/sync-complete",
  "headers": {
    "Content-Type": "application/json",
    "x-api-key": "{{ $credentials.apiKey }}"
  },
  "body": {
    "sync_id": "{{ $('Set sync_id').item.json.sync_id }}",
    "empresa_id": 1
  }
}
```

## 🔧 Troubleshooting

### Erro: Timeout na requisição
- Reduza o `batchSize` para 15.000
- Aumente o `timeout` para 300.000ms

### Erro: Deadlock detected
- Aumente o `Wait` entre chunks para 5 segundos
- Verifique se não há outras sincronizações simultâneas

### Erro: Memory exhausted no N8N
- Processe em lotes menores (10.000)
- Use a configuração `splitInBatches` com `reset: true`

### Performance abaixo do esperado
- Verifique índices no ERP (data_modificacao, data_vencimento)
- Verifique conexão de rede entre N8N e Supabase
- Considere executar fora do horário comercial

## 📊 Monitoramento

### Query de progresso em tempo real
```sql
SELECT 
  sync_id,
  chunk_number,
  records_processed,
  records_inserted,
  records_updated,
  records_skipped,
  duration_ms,
  status
FROM sync_chunks_tracking
WHERE entidade = 'contas_pagar'
ORDER BY created_at DESC
LIMIT 50;
```

### Query de resumo
```sql
SELECT * FROM sync_chunks_progress
WHERE entidade = 'contas_pagar'
ORDER BY started_at DESC
LIMIT 10;
```

## ✅ Checklist de Implementação

- [ ] Configurar N8N_API_KEY no Supabase Secrets
- [ ] Criar workflow no N8N com os nós acima
- [ ] Testar com pequeno volume (1.000 registros)
- [ ] Validar dados no Supabase
- [ ] Configurar alertas de erro no N8N
- [ ] Agendar execuções automáticas
- [ ] Monitorar primeiras execuções completas
