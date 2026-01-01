# Integração N8N - Contas a Receber

## Visão Geral

Esta documentação descreve a integração entre o Lovable CRM e o N8N para sincronização de Contas a Receber do ERP.

## Webhook MCP

### Endpoint

```
POST https://huggs.app.n8n.cloud/webhook/contas-receber-mcp
```

### Headers

```json
{
  "Content-Type": "application/json"
}
```

### Payload de Requisição

```json
{
  "tableName": "ConsultaPowerBIReceber",
  "limit": 1000,
  "offset": 0,
  "filters": {}
}
```

#### Parâmetros

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `tableName` | string | `ConsultaPowerBIReceber` | Nome da tabela SQL no ERP |
| `limit` | number | 100 | Quantidade de registros (máx: 1000) |
| `offset` | number | 0 | Registros a pular (paginação) |
| `filters` | object | `{}` | Filtros adicionais |

### Resposta

```json
{
  "success": true,
  "metadata": {
    "tableName": "ConsultaPowerBIReceber",
    "recordsReturned": 1000,
    "offset": 0,
    "limit": 1000,
    "hasMoreData": true,
    "nextOffset": 1000,
    "query": "SELECT...",
    "timestamp": "2025-01-01T00:00:00.000Z"
  },
  "data": [
    {
      "ID Empresa": 1,
      "Empresa": "EMPRESA LTDA",
      "Tipo": "NF",
      "Nota": "123456",
      "Seq": 1,
      "Codigo": "CLI001",
      "Cliente": "CLIENTE EXEMPLO",
      "Valor_Trc": 1500.00,
      "Valor em Aberto": 500.00,
      "Valor Pago": 1000.00,
      "Emissao": "2025-01-01",
      "Vencimento": "2025-02-01",
      "Pagamento": null,
      "Status": "aberto",
      "Portador": "BANCO X"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 1000,
    "totalRecordsInPage": 1000
  }
}
```

## Fluxos de Sincronização

### 1. Fluxo Agendado (N8N → Supabase)

Executado automaticamente a cada 40 minutos.

```
Trigger (Schedule)
    ↓
SQL Query (ERP)
    ↓
Split in Batches (1000)
    ↓
HTTP POST → /bulk-sync
    ↓
Log Result
```

### 2. Fluxo Manual (Lovable → N8N → Supabase)

Iniciado pelo usuário via interface.

```
Botão "Sincronizar"
    ↓
Edge Function (n8n-contas-receber/sync-all)
    ↓
Loop de Paginação:
    ├── POST webhook (limit=1000, offset=N)
    ├── Transform data
    ├── RPC bulk_upsert_contas_receber_v2
    └── Incrementa offset se hasMoreData=true
    ↓
Retorna resumo
```

## Edge Function: n8n-contas-receber

### Endpoints Disponíveis

#### GET /status

Verifica conectividade com N8N e retorna estatísticas.

```bash
curl -X POST \
  https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/n8n-contas-receber/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### POST /query

Consulta uma página de dados do ERP.

```bash
curl -X POST \
  https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/n8n-contas-receber/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 100, "offset": 0}'
```

#### POST /preview

Retorna preview dos primeiros registros (transformados).

```bash
curl -X POST \
  https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/n8n-contas-receber/preview \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

#### POST /sync-all

Executa sincronização completa com paginação automática.

```bash
curl -X POST \
  https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/n8n-contas-receber/sync-all \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 1000}'
```

## Mapeamento de Campos

| Campo ERP | Campo Local | Tipo |
|-----------|-------------|------|
| `ID Empresa` | `empresa_id` | number |
| `Empresa` | `empresa_nome` | string |
| `Tipo` | `tipo_documento` | string |
| `Nota` | `numero_documento` | string |
| `Seq` | `parcela` | number |
| `Codigo` | `cliente_codigo` | string |
| `Cliente` | `cliente_nome` | string |
| `Valor_Trc` | `valor_original` | number |
| `Valor em Aberto` | `valor_aberto` | number |
| `Valor Pago` | `valor_pago` | number |
| `Emissao` | `data_emissao` | date |
| `Vencimento` | `data_vencimento` | date |
| `Pagamento` | `data_pagamento` | date |
| `Status` | `status` | string |
| `Portador` | `portador` | string |

## Performance

| Volume | Páginas | Tempo Estimado |
|--------|---------|----------------|
| 100k | 100 | 2-3 min |
| 500k | 500 | 8-12 min |
| 1M | 1000 | 18-25 min |
| 1.5M | 1500 | 25-35 min |

## Monitoramento

### Logs de Sincronização

Os logs são salvos na tabela `sync_logs`:

```sql
SELECT * FROM sync_logs 
WHERE tipo = 'contas_receber' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Métricas Disponíveis

- Total de registros processados
- Páginas processadas
- Duração da sincronização
- Erros encontrados
- Registros por segundo

## Troubleshooting

### Erro: "N8N webhook error"

1. Verifique se o workflow N8N está ativo
2. Teste o webhook diretamente via Postman/curl
3. Verifique os logs do N8N

### Sincronização lenta

1. Reduza o `batchSize` se houver timeouts
2. Verifique a performance do banco de dados
3. Considere sincronizar em horários de menor uso

### Dados duplicados

O sistema usa `erp_id` como chave única para upsert. Verifique se os campos que compõem o `erp_id` estão corretos:
- `ID Empresa`
- `Tipo`
- `Nota`
- `Seq`

## Suporte

Para problemas com a integração, verifique:
1. Logs da edge function no Supabase
2. Logs do workflow no N8N
3. Tabela `sync_logs` para histórico de sincronizações
