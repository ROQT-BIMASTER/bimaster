

# Restaurar sincronização N8N → Contas a Pagar (função isolada)

## O que será criado

### 1. Nova edge function: `contas-pagar-n8n-sync`

`supabase/functions/contas-pagar-n8n-sync/index.ts` — isolada, sem `secureHandler`, sem IA, sem WAF. Replica o contrato antigo do N8N que funcionava em produção.

**Contrato:**
- `POST` direto (sem path adicional).
- Header: `x-api-key: <N8N_API_KEY>`.
- Body aceita 3 formatos (na ordem de detecção):
  1. `$items()` do N8N: `[{ json: {...} }, ...]` → desempacota `.json`.
  2. Wrapper: `{ contas: [...] }` ou `{ data: [...] }`.
  3. Array bruto: `[{...}, {...}]`.
- Campos brutos do ERP aceitos sem Zod estrito (`ID Empresa`, `Tipo`, `Nota`, `Seq`, `Código`, `Valor_Trc`, `Valor em Aberto`, `Valor Pago`, `Emissão`, `Vencimento`, `Data Pgto`, `Cliente`, etc.).

**Comportamento:**
- Reusa `transformErpData`, `generateErpId` e `processRecordsWithRetry` de `_shared/contas-pagar/utils.ts` (paridade total com a API nova, sem duplicar lógica).
- Mini-batches de 100 itens, retry exponencial herdado do shared util.
- Loga resultado em `sync_control` (entidade=`contas_pagar`).
- Dispara `recalculate_contas_pagar_status` ao final.
- Resposta no shape esperado pelo N8N:
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

### 2. Documentação

Criar `docs/N8N_WEBHOOK_CONTAS_PAGAR.md` com:
- URL: `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-pagar-n8n-sync`
- Headers e exemplos dos 3 formatos.
- Instrução: trocar apenas a URL no workflow N8N.

## Não-escopo (intocado)

- `contas-pagar-api/` e `_shared/contas-pagar/` — zero alteração.
- `processar-transacao-n8n` — preservada (continua útil para pipeline IA).
- SDK / OpenAPI / `APP_VERSION` — sem bump.

## Validação pós-deploy

1. `curl` smoke test com 1 item formato `$items()` → esperado 200 com `processed:1`.
2. Verificar linha em `sync_control` com `entidade='contas_pagar'`, `status='success'`.
3. Confirmar idempotência: mesmo `erp_id` reenviado → `skipped:1`.
4. N8N aponta para nova URL e roda batch real de 2.000 itens.

## Impacto

**+1 função** (~150 linhas), **+1 doc**. Zero migrações. Risco baixo — função isolada, idempotente por `erp_id`.

