# Workflow N8N - Estoque (1M+ Movimentações)

Configuração otimizada para sincronização de mais de 1 milhão de movimentações de estoque.

## 📊 Arquitetura Recomendada

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WORKFLOW ESTOQUE                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │           FASE 1: Dados Mestres (sequencial)             │     │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │     │
│   │  │Distribuidoras│─▶│  Produtos   │─▶│ Vinculações │      │     │
│   │  └─────────────┘  └─────────────┘  └─────────────┘      │     │
│   └──────────────────────────────────────────────────────────┘     │
│                              │                                      │
│                              ▼                                      │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │           FASE 2: Movimentações (paralelo)               │     │
│   │  ┌──────────┐    ┌───────────┐    ┌────────────────┐    │     │
│   │  │  Trigger │───▶│ SQL Query │───▶│ Split (10k)    │    │     │
│   │  └──────────┘    └───────────┘    └────────────────┘    │     │
│   │                                          │               │     │
│   │  ┌────────────────────────────────────────────────────┐ │     │
│   │  │ POST /bulk-movimentacoes  │  Wait 2s  │  Retry    │ │     │
│   │  └────────────────────────────────────────────────────┘ │     │
│   └──────────────────────────────────────────────────────────┘     │
│                              │                                      │
│                              ▼                                      │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │                  POST /sync-complete                      │     │
│   └──────────────────────────────────────────────────────────┘     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## ⚙️ Configurações de Performance

### Parâmetros Recomendados

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| **Chunk Size (Movimentações)** | 10.000 | Registros por requisição |
| **Chunk Size (Mestres)** | 5.000 | Para distribuidoras/produtos |
| **Timeout** | 120s | Timeout da requisição HTTP |
| **Delay entre chunks** | 2s | Pausa entre requisições |
| **Max Retries** | 5 | Tentativas em caso de erro |

### Performance Esperada

| Tipo | Registros | Tempo Estimado |
|------|-----------|----------------|
| **Distribuidoras** | 1.000 | ~5 segundos |
| **Produtos Master** | 50.000 | ~30 segundos |
| **Vinculações** | 100.000 | ~2 minutos |
| **Movimentações** | 500.000 | ~10 minutos |
| **Movimentações** | 1.000.000 | ~20 minutos |

## 📅 Cronograma de Sincronização

```
┌────────────────────────────────────────────────────────────┐
│                    AGENDA DIÁRIA                            │
├──────────┬─────────────────────────────────────────────────┤
│ 03:00 AM │ Full Sync - Dados Mestres + Movimentações       │
├──────────┼─────────────────────────────────────────────────┤
│ 09:00 AM │ Incremental - Movimentações últimas 6h          │
├──────────┼─────────────────────────────────────────────────┤
│ 15:00 PM │ Incremental - Movimentações últimas 6h          │
├──────────┼─────────────────────────────────────────────────┤
│ 21:00 PM │ Incremental - Movimentações últimas 6h          │
└──────────┴─────────────────────────────────────────────────┘
```

## 🔌 Endpoints Disponíveis

### POST /bulk-movimentacoes
Sincronização em massa de movimentações.

**Request:**
```json
{
  "sync_id": "uuid-do-sync",
  "chunk_number": 1,
  "total_chunks": 100,
  "transaction_id": "tx-20240115-001",
  "movimentacoes": [
    {
      "cnpj_distribuidora": "12.345.678/0001-90",
      "codigo_produto": "PROD001",
      "tipo_movimento": "entrada",
      "quantidade": 100,
      "lote": "LOTE2024001",
      "localizacao": "A1-B2-C3",
      "data_validade": "2025-06-30",
      "custo_unitario": 15.50,
      "documento_referencia": "NF-123456",
      "observacao": "Entrada por compra",
      "origem": "FORNECEDOR ABC"
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
    "total_received": 10000,
    "processed": 9950,
    "errors": 50
  },
  "duration_ms": 850,
  "performance": {
    "records_per_second": 11765
  }
}
```

### POST / (Dados Mestres)
Para distribuidoras, produtos e vinculações.

**Request:**
```json
{
  "tipo": "completo",
  "dados": {
    "distribuidoras": [
      {
        "nome": "Distribuidora ABC",
        "cnpj": "12.345.678/0001-90",
        "cidade": "São Paulo",
        "uf": "SP"
      }
    ],
    "produtos_master": [
      {
        "nome": "Produto XYZ",
        "sku_master": "SKU001",
        "unidade_medida": "UN",
        "categoria": "MEDICAMENTOS"
      }
    ],
    "vinculacoes": [
      {
        "sku_master": "SKU001",
        "cnpj_distribuidora": "12.345.678/0001-90",
        "codigo_produto_distribuidora": "PROD001",
        "fator_conversao": 1.0
      }
    ]
  }
}
```

### POST /sync-complete
Finaliza a sincronização.

```json
{
  "sync_id": "uuid-do-sync"
}
```

## 📋 Configuração N8N - Workflow Completo

### Fase 1: Dados Mestres

#### 1.1 HTTP Request (Distribuidoras)
```json
{
  "method": "POST",
  "url": "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/estoque-n8n-sync",
  "headers": {
    "Content-Type": "application/json",
    "x-api-key": "{{ $credentials.apiKey }}"
  },
  "body": {
    "tipo": "distribuidoras",
    "dados": {
      "distribuidoras": "{{ $json.distribuidoras }}"
    }
  }
}
```

#### 1.2 HTTP Request (Produtos Master)
```json
{
  "method": "POST",
  "url": "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/estoque-n8n-sync",
  "body": {
    "tipo": "produtos_master",
    "dados": {
      "produtos_master": "{{ $json.produtos }}"
    }
  }
}
```

#### 1.3 HTTP Request (Vinculações)
```json
{
  "method": "POST",
  "url": "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/estoque-n8n-sync",
  "body": {
    "tipo": "vinculacoes",
    "dados": {
      "vinculacoes": "{{ $json.vinculacoes }}"
    }
  }
}
```

### Fase 2: Movimentações

#### 2.1 SQL Query (Full Sync)
```sql
SELECT 
    D.CNPJ AS cnpj_distribuidora,
    P.CODIGO AS codigo_produto,
    M.TIPO AS tipo_movimento,
    M.QUANTIDADE AS quantidade,
    M.LOTE AS lote,
    M.LOCALIZACAO AS localizacao,
    M.DATA_VALIDADE AS data_validade,
    M.CUSTO_UNITARIO AS custo_unitario,
    M.DOCUMENTO AS documento_referencia,
    M.OBSERVACAO AS observacao,
    M.ORIGEM AS origem,
    M.DESTINO AS destino
FROM MOVIMENTACOES M
    INNER JOIN DISTRIBUIDORAS D ON M.ID_DISTRIBUIDORA = D.ID
    INNER JOIN PRODUTOS P ON M.ID_PRODUTO = P.ID
WHERE M.DATA >= DATEADD(YEAR, -1, GETDATE())
ORDER BY M.DATA DESC
```

#### 2.2 SQL Query (Incremental)
```sql
SELECT /* mesmos campos */
FROM MOVIMENTACOES M
    /* mesmos JOINs */
WHERE M.DATA >= DATEADD(HOUR, -6, GETDATE())
ORDER BY M.DATA DESC
```

#### 2.3 Split In Batches
```json
{
  "batchSize": 10000
}
```

#### 2.4 HTTP Request (bulk-movimentacoes)
```json
{
  "method": "POST",
  "url": "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/estoque-n8n-sync/bulk-movimentacoes",
  "options": {
    "timeout": 120000,
    "retry": {
      "enabled": true,
      "maxTries": 5,
      "retryInterval": 5000
    }
  },
  "headers": {
    "Content-Type": "application/json",
    "x-api-key": "{{ $credentials.apiKey }}"
  },
  "body": {
    "sync_id": "{{ $('Set sync_id').item.json.sync_id }}",
    "chunk_number": "{{ $runIndex + 1 }}",
    "total_chunks": "{{ Math.ceil($('SQL Query').length / 10000) }}",
    "transaction_id": "{{ $now.format('YYYYMMDD-HHmmss') }}",
    "movimentacoes": "{{ $json }}"
  }
}
```

## 🔄 Tipos de Movimentação

| Tipo | Descrição | Efeito no Saldo |
|------|-----------|-----------------|
| `entrada` | Entrada de estoque | Aumenta quantidade |
| `saida` | Saída de estoque | Diminui quantidade |
| `inventario` | Ajuste de inventário | Substitui quantidade |
| `ajuste` | Ajuste manual | Soma/subtrai quantidade |
| `transferencia` | Transferência entre locais | Origem: diminui, Destino: aumenta |

## 🔧 Troubleshooting

### Erro: Distribuidora não encontrada
- Execute primeiro o workflow de dados mestres (distribuidoras)
- Verifique se o CNPJ está no formato correto

### Erro: Produto não vinculado
- Execute primeiro as vinculações após produtos e distribuidoras
- Verifique se o código do produto corresponde ao cadastro

### Performance lenta
- Reduza batch size para 5.000
- Verifique índices na tabela de origem
- Execute fora do horário comercial

### Movimentações duplicadas
- Use `transaction_id` único por execução
- Verifique se não há workflows duplicados

## 📊 Monitoramento

### Query de progresso
```sql
SELECT 
  sync_id,
  chunk_number,
  records_processed,
  records_error,
  duration_ms,
  status
FROM sync_chunks_tracking
WHERE entidade = 'estoque_movimentacoes'
ORDER BY created_at DESC
LIMIT 50;
```

### Query de saldos atualizados
```sql
SELECT 
  d.nome AS distribuidora,
  pm.nome AS produto,
  s.lote,
  s.quantidade_disponivel,
  s.updated_at
FROM estoque_saldos s
  JOIN estoque_distribuidoras d ON s.distribuidora_id = d.id
  JOIN estoque_produtos_distribuidora pd ON s.produto_distribuidora_id = pd.id
  JOIN estoque_produtos_master pm ON pd.produto_master_id = pm.id
WHERE s.updated_at >= NOW() - INTERVAL '1 hour'
ORDER BY s.updated_at DESC;
```

## ✅ Checklist de Implementação

### Pré-requisitos
- [ ] N8N_API_KEY configurada no Supabase
- [ ] Tabelas de estoque criadas
- [ ] Acesso ao banco ERP configurado

### Configuração
- [ ] Workflow de dados mestres criado
- [ ] Workflow de movimentações criado
- [ ] Triggers agendados

### Validação
- [ ] Teste com 100 registros
- [ ] Teste com 10.000 registros
- [ ] Validar saldos no Supabase

### Produção
- [ ] Carga inicial completa executada
- [ ] Sincronizações incrementais ativas
- [ ] Alertas de erro configurados
