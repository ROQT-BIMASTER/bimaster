# Integração N8N - Contas a Receber (v5.0.0)

## Visão Geral

Esta documentação descreve a integração entre o Lovable CRM e o N8N para sincronização de Contas a Receber do ERP.

## ⚠️ CONFIGURAÇÃO IMPORTANTE DO N8N

O workflow N8N atual está configurado com `batchSize: 500`. Para **máxima performance**, altere para:

```javascript
// No nó "Workflow Configuration"
batchSize: 2000  // Recomendado: 2000-5000 registros por batch
```

**Impacto estimado:**
| Batch Size | Registros | Tempo Estimado |
|------------|-----------|----------------|
| 500        | 50.000    | ~20 minutos    |
| 2000       | 50.000    | ~5 minutos     |
| 5000       | 50.000    | ~2 minutos     |

## Endpoint da API

### URL Base
```
https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-receber-api
```

### POST /sync

Endpoint principal para sincronização de dados.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "x-api-key": "cr_sync_2024_f7k9Lm3nPqRs8tUv"
}
```

**Body (N8N usa $items()):**
```json
{
  "contas": {{ JSON.stringify($items()) }}
}
```

**Resposta:**
```json
{
  "success": true,
  "continue_loop": true,
  "received": 2000,
  "transformed": 2000,
  "processed": 2000,
  "errors": 0,
  "duration_ms": 1500,
  "rate_per_second": 1333,
  "api_version": "5.0.0"
}
```

## Formato dos Dados do ERP

A API aceita múltiplos formatos de campos. Os mais comuns são:

| Campo ERP | Campo Alternativo | Tipo |
|-----------|-------------------|------|
| `ID Empresa` | `empresa_id` | number |
| `Empresa` | `empresa_nome` | string |
| `Tipo` | `tipo_documento` | string |
| `Nota` | `numero_documento` | string |
| `Seq` | `parcela` | number |
| `Código` | `cliente_codigo` | string |
| `Cliente` | `cliente_nome` | string |
| `Valor_Trc` | `valor_original` | number |
| `Valor em Aberto` | `valor_aberto` | number |
| `Valor Pago` | `valor_recebido` | number |
| `Emissão` | `data_emissao` | date |
| `Vencimento` | `data_vencimento` | date |
| `Data Pgto` | `data_recebimento` | date |
| `Nome Portador` | `portador` | string |

## Fluxo de Sincronização

```
Schedule (a cada 40 min)
    ↓
SQL Query (ERP) - Busca registros
    ↓
Check If More Data
    ↓
Loop Over Items (batch 2000)
    ↓
POST /sync → API v5.0.0
    ↓
Próximo batch (se houver)
    ↓
Done
```

## Performance (API v5.0.0)

| Parâmetro | Valor |
|-----------|-------|
| Rate Limiter | **DESABILITADO** |
| Batch Size Interno | 2000 registros |
| Delay entre batches | 5ms |
| Formato suportado | `$items()` com wrapper `{json: {...}}` |
| Processamento | Upsert incremental por `erp_id` |

### Taxas Observadas

| Volume | Batches | Tempo | Taxa |
|--------|---------|-------|------|
| 10.000 | 5 | ~30s | 333/s |
| 50.000 | 25 | ~2min | 416/s |
| 100.000 | 50 | ~4min | 416/s |

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
