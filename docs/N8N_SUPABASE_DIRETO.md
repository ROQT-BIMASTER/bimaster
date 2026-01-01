# Integração N8N com Supabase Direto

## Configuração do Credential Supabase no N8N

### Passo 1: Criar Credencial Supabase

No N8N:
1. Vá em **Credentials** → **Add Credential**
2. Busque por **"Supabase"**
3. Preencha:

| Campo | Valor |
|-------|-------|
| **Host** | `https://aokkyrgaqjarhlywhjju.supabase.co` |
| **Service Role Secret** | *(copie de Lovable Cloud → Secrets → SUPABASE_SERVICE_ROLE_KEY)* |

4. Salve como **"Lovable Supabase"**

---

## Novo Fluxo N8N: Sync Direto para Supabase

### Arquitetura

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Schedule       │───▶│  SQL Server ERP  │───▶│  Transform      │
│  (40 min)       │    │  (Batch 5000)    │    │  Data           │
└─────────────────┘    └──────────────────┘    └────────┬────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Update Control │◀───│  Supabase Node   │◀───│  Split Batches  │
│  Table          │    │  (Upsert 1000)   │    │  (1000 records) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Nodes Necessários

#### 1. Schedule Trigger
```json
{
  "rule": {
    "interval": [{"field": "minutes", "minutesInterval": 40}]
  }
}
```

#### 2. Configuration Set
```json
{
  "assignments": [
    {"name": "sqlTableName", "value": "ConsultaPowerBIReceber", "type": "string"},
    {"name": "supabaseTable", "value": "contas_receber", "type": "string"},
    {"name": "batchSize", "value": 5000, "type": "number"},
    {"name": "upsertBatchSize", "value": 1000, "type": "number"}
  ]
}
```

#### 3. Microsoft SQL - Buscar Dados
```sql
SELECT TOP {{ $json.batchSize }}
  [ID Empresa] as empresa_id,
  [Empresa] as empresa_nome,
  [Tipo] as tipo_documento,
  [Nota] as numero_documento,
  [Seq] as parcela,
  [Codigo] as cliente_codigo,
  [Cliente] as cliente_nome,
  [Valor_Trc] as valor_original,
  [Valor em Aberto] as valor_aberto,
  [Valor Pago] as valor_pago,
  [Emissao] as data_emissao,
  [Vencimento] as data_vencimento,
  [Pagamento] as data_pagamento,
  [Status] as status,
  [Portador] as portador,
  CONCAT([ID Empresa], '-', [Tipo], '-', [Nota], '-', [Seq]) as erp_id
FROM dbo.ConsultaPowerBIReceber
ORDER BY [Vencimento] DESC
OFFSET {{ $json.offset || 0 }} ROWS
```

#### 4. Code Node - Transformar Dados
```javascript
const items = $input.all();
const now = new Date().toISOString();

const transformed = items.map(item => {
  const data = item.json;
  
  // Calcular dias de atraso
  let diasAtraso = 0;
  if (data.data_vencimento && data.status !== 'recebido') {
    const vencimento = new Date(data.data_vencimento);
    const hoje = new Date();
    diasAtraso = Math.floor((hoje - vencimento) / (1000 * 60 * 60 * 24));
  }
  
  // Determinar status normalizado
  let statusNormalizado = 'pendente';
  if (data.status === 'recebido' || data.valor_aberto <= 0) {
    statusNormalizado = 'recebido';
  } else if (diasAtraso > 0) {
    statusNormalizado = 'vencido';
  }
  
  return {
    json: {
      erp_id: data.erp_id,
      empresa_id: parseInt(data.empresa_id) || 1,
      empresa_nome: data.empresa_nome?.trim() || null,
      tipo_documento: data.tipo_documento?.trim() || null,
      numero_documento: data.numero_documento?.toString().trim() || null,
      parcela: parseInt(data.parcela) || 1,
      cliente_codigo: data.cliente_codigo?.toString().trim() || null,
      cliente_nome: data.cliente_nome?.trim() || null,
      valor_original: parseFloat(data.valor_original) || 0,
      valor_aberto: parseFloat(data.valor_aberto) || 0,
      valor_pago: parseFloat(data.valor_pago) || 0,
      data_emissao: data.data_emissao || null,
      data_vencimento: data.data_vencimento || null,
      data_pagamento: data.data_pagamento || null,
      data_recebimento: statusNormalizado === 'recebido' ? data.data_pagamento : null,
      status: statusNormalizado,
      portador: data.portador?.trim() || null,
      dias_atraso: diasAtraso > 0 ? diasAtraso : 0,
      sincronizado_em: now
    }
  };
});

return transformed;
```

#### 5. Split In Batches
- **Batch Size**: 1000
- **Options**: Reset

#### 6. Supabase Node - Upsert
```json
{
  "operation": "upsert",
  "tableId": "contas_receber",
  "conflictKey": "erp_id",
  "dataMode": "autoMapInputData"
}
```

**Configuração do Node:**
- **Resource**: Row
- **Operation**: Upsert
- **Table**: contas_receber
- **Conflict Column**: erp_id (coluna única para identificar registros)
- **Columns to Upsert**: Auto-map (mapeia automaticamente os campos)

#### 7. Supabase Node - Atualizar Controle
```json
{
  "operation": "update",
  "tableId": "sync_tracking",
  "filters": {
    "entidade": "contas_receber"
  },
  "fieldsUi": {
    "fieldValues": [
      {"fieldName": "status", "fieldValue": "completed"},
      {"fieldName": "last_sync_at", "fieldValue": "={{ $now }}"},
      {"fieldName": "records_processed", "fieldValue": "={{ $items.length }}"}
    ]
  }
}
```

---

## Vantagens do Supabase Direto

| Aspecto | HTTP (atual) | Supabase Direto |
|---------|-------------|-----------------|
| **Latência** | ~200-500ms por batch | ~50-100ms por batch |
| **Rate Limit** | Edge Function limits | Sem limite adicional |
| **Logs** | Edge Function logs | Logs Supabase nativos |
| **Retry** | Implementar manual | N8N built-in |
| **Timeout** | 30s Edge Function | Configurável |

---

## Configuração Recomendada para 1.5M Registros

```javascript
// Configuração para alto volume
const config = {
  // SQL batches maiores = menos queries
  sqlBatchSize: 10000,
  
  // Upsert batches menores = menos chance de timeout
  upsertBatchSize: 1000,
  
  // Delay entre batches para não sobrecarregar
  delayBetweenBatches: 500, // ms
  
  // Retry automático
  maxRetries: 3,
  retryDelay: 2000
};
```

### Estimativa de Tempo

| Volume | Tempo Estimado |
|--------|---------------|
| 100k registros | 3-5 min |
| 500k registros | 15-20 min |
| 1M registros | 30-40 min |
| 1.5M registros | 45-60 min |

---

## Monitoramento

### Query para verificar progresso
```sql
SELECT 
  COUNT(*) as total_registros,
  COUNT(*) FILTER (WHERE sincronizado_em > NOW() - INTERVAL '1 hour') as sincronizados_ultima_hora,
  MAX(sincronizado_em) as ultima_sincronizacao
FROM contas_receber;
```

### Verificar controle de sync
```sql
SELECT * FROM sync_tracking 
WHERE entidade = 'contas_receber' 
ORDER BY last_sync_at DESC 
LIMIT 5;
```

---

## Troubleshooting

### Erro: "duplicate key value violates unique constraint"
- O upsert está funcionando - isso não deveria acontecer
- Verifique se `erp_id` está sendo gerado corretamente

### Erro: "timeout"
- Reduza `upsertBatchSize` para 500
- Aumente delay entre batches

### Erro: "invalid input syntax for type uuid"
- Verifique se os campos UUID estão sendo passados corretamente
- O campo `erp_id` deve ser string, não UUID
