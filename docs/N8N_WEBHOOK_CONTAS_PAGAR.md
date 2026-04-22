# Integração N8N — Contas a Pagar (v1.0.0)

## Visão Geral

Endpoint dedicado para sincronização em massa do N8N → tabela `contas_pagar`, isolado da `contas-pagar-api` nova. Foi criado para restaurar o canal de produção do N8N que parou de funcionar quando o pipeline antigo (`processar-transacao-n8n`) recebeu camadas de IA + WAF que estouravam timeout em lotes grandes.

**Resumo do que muda no N8N:** trocar apenas a URL do POST. Headers, payload e shape da resposta são idênticos ao formato `$items()` que estava em produção.

## Endpoint

```
POST https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-pagar-n8n-sync
```

### Headers obrigatórios

```json
{
  "Content-Type": "application/json",
  "x-api-key": "<N8N_API_KEY>"
}
```

> A `N8N_API_KEY` é a mesma chave já usada no workflow legado. Não foi rotacionada.

### Health check (GET)

```bash
curl https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-pagar-n8n-sync
# → { "ok": true, "service": "contas-pagar-n8n-sync", "api_version": "n8n-cp-1.0.0", ... }
```

## Formatos de body aceitos

A função detecta automaticamente os 3 formatos (na ordem):

### 1. `$items()` puro do N8N (recomendado — formato em produção)

```json
[
  { "json": { "ID Empresa": 2, "Tipo": "8", "Nota": "71006", "Seq": 2, "Código": "3", "Valor_Trc": 0.01, "Vencimento": "2089-12-31" } },
  { "json": { "ID Empresa": 2, "Tipo": "8", "Nota": "71007", "Seq": 1, "Código": "3", "Valor_Trc": 150.00, "Vencimento": "2025-12-15" } }
]
```

Body do nó HTTP Request no N8N: `{{ JSON.stringify($items()) }}`

### 2. Wrapper

```json
{ "contas": [ { "ID Empresa": 2, "Tipo": "8", ... } ] }
```

Aceita também as chaves `data`, `transacoes`, `items`, `records`.

### 3. Array bruto

```json
[ { "ID Empresa": 2, "Tipo": "8", ... }, { "ID Empresa": 2, "Tipo": "8", ... } ]
```

## Campos do ERP aceitos

Os campos brutos do PowerBI/ERP passam direto pelo `transformErpData` da API nova (paridade total):

| Campo ERP            | Alternativo            | Tipo    |
| -------------------- | ---------------------- | ------- |
| `ID Empresa`         | `empresa_id`           | number  |
| `Empresa`            | `empresa_nome`         | string  |
| `Tipo`               | `tipo_documento`       | string  |
| `Nota`               | `numero_documento`     | string  |
| `Seq`                | `parcela`              | number  |
| `Código`             | `fornecedor_codigo`    | string  |
| `Cliente`            | `fornecedor_nome`      | string  |
| `Valor_Trc`          | `valor_original`       | number  |
| `Valor em Aberto`    | `valor_aberto`         | number  |
| `Valor Pago`         | `valor_pago`           | number  |
| `Valor Juros`        | `valor_juros`          | number  |
| `Valor Desconto`     | `valor_desconto`       | number  |
| `Valor Ajustes`      | `valor_ajustes`        | number  |
| `Emissão`            | `data_emissao`         | date    |
| `Vencimento`         | `data_vencimento`      | date    |
| `Data Pgto`          | `data_pagamento`       | date    |
| `ID Historico`       | `categoria_codigo`     | string  |
| `Historico`          | `categoria_nome`       | string  |
| `Portador`           | `portador`             | string  |
| `Conta`              | `conta`                | string  |

A chave única (`erp_id`) é gerada por `${ID Empresa}-${Tipo}-${Nota}-${Seq}-${Código}` — idêntica à API nova, garantindo idempotência cruzada.

## Resposta

```json
{
  "success": true,
  "received": 2000,
  "processed": 2000,
  "inserted": 120,
  "updated": 80,
  "skipped": 1800,
  "errors": 0,
  "duration_ms": 4500,
  "rate_per_second": 444,
  "api_version": "n8n-cp-1.0.0"
}
```

| Status HTTP | Significado                                                |
| ----------- | ---------------------------------------------------------- |
| 200         | Sucesso total (`errors: 0`)                                |
| 207         | Sucesso parcial (alguns batches falharam, outros gravaram) |
| 400         | JSON inválido                                              |
| 401         | `x-api-key` ausente ou inválido                            |
| 413         | Payload acima do limite (>200.000 registros)               |
| 500         | `N8N_API_KEY` não configurada no servidor                  |

## Comportamento interno

| Aspecto              | Valor                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| Auth                 | `x-api-key` manual (sem JWT, sem `secureHandler`, sem WAF)               |
| Rate limiter         | **Desabilitado** (gargalo do antigo `bulk-sync`)                         |
| Mini-batch           | 100 registros / batch                                                    |
| Delay entre batches  | 150ms                                                                    |
| Limite de payload    | 200.000 registros / request                                              |
| Retry                | Exponencial (5 tentativas) herdado do `withRetry` compartilhado          |
| Upsert               | RPC `bulk_upsert_contas_pagar_v2` (mesma da API nova) — chave: `erp_id`  |
| Hash incremental     | SHA-256 sobre valores + datas — pula update se nada mudou (`skipped`)    |
| Pós-processamento    | `recalculate_contas_pagar_status` (RPC)                                  |
| Log de execução      | Tabela `sync_control` (entidade=`contas_pagar`, origem=`n8n`)            |

## Smoke test após deploy

```bash
curl -X POST https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-pagar-n8n-sync \
  -H "Content-Type: application/json" \
  -H "x-api-key: $N8N_API_KEY" \
  -d '[{"json":{"ID Empresa":2,"Tipo":"8","Nota":"71006","Seq":2,"Código":"3","Valor_Trc":0.01,"Vencimento":"2089-12-31"}}]'
```

Esperado: `200` com `{"success": true, "processed": 1, ...}`. Reenviar o mesmo payload deve resultar em `skipped: 1`.

## Migração no N8N

No nó HTTP Request do workflow de Contas a Pagar:

1. **URL antiga:** `.../functions/v1/processar-transacao-n8n` (ou similar)
2. **URL nova:** `.../functions/v1/contas-pagar-n8n-sync`
3. **Headers:** mantém `x-api-key`. Remover `Authorization` se houver.
4. **Body:** mantém `{{ JSON.stringify($items()) }}` — sem alterações.

Nada mais muda. O batchSize do workflow pode subir para 2.000 com segurança.

## Por que existe (e por que não usar a API nova)

- A `contas-pagar-api/sync` nova é validada por Zod estrito + `secureHandler` (WAF L7) e foi desenhada para integração API ↔ App, não para lotes massivos do N8N.
- O `processar-transacao-n8n` legado fazia classificação de IA por item, o que estourava timeout em batches do PowerBI.
- Esta função isolada **reusa a mesma lógica de upsert** (`processRecordsWithRetry`, `transformErpData`, `generateErpId`) da API nova, garantindo paridade total de dados sem expor o pipeline ao WAF nem à IA.
