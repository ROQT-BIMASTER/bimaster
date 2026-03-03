

# Fix: Pagamentos não finalizando corretamente

## Diagnóstico

Os dados **estão chegando** do n8n (última sync: 20:40 UTC, 4313 registros processados, 167 inseridos, 48 atualizados). O loop infinito foi corrigido. Porém há um **bug na lógica de status** da função SQL `bulk_upsert_contas_pagar_v2`:

```sql
-- ERRADO (atual):
WHEN t.valor_aberto <= 0 OR t.valor_pago > 0 THEN 'pago'
```

O operador **`OR`** marca qualquer registro com `valor_pago > 0` como "pago", mesmo que `valor_aberto > 0` (pagamento parcial). Isso mistura pagos com parciais.

Além disso, a função `recalculate_contas_pagar_status` só corrige registros com `status IN ('pendente', 'vencido')`, então registros **incorretamente marcados como 'pago'** pelo bulk_upsert não são reclassificados.

## Plano de Correção

### 1. Corrigir lógica de status na `bulk_upsert_contas_pagar_v2`

Substituir a lógica de status (aparece 2x: INSERT e UPDATE) de:
```sql
WHEN t.valor_aberto <= 0 OR t.valor_pago > 0 THEN 'pago'
```
Para:
```sql
WHEN t.valor_aberto <= 0 THEN 'pago'
WHEN t.valor_pago > 0 AND t.valor_aberto > 0 THEN 'parcial'
WHEN t.data_vencimento < v_today THEN 'vencido'
ELSE 'pendente'
```

### 2. Expandir `recalculate_contas_pagar_status` para corrigir registros "pago" incorretos

Adicionar regra para reclassificar:
- `status = 'pago' AND valor_aberto > 0 AND valor_pago > 0` → 'parcial'
- `status = 'pago' AND valor_aberto > 0 AND valor_pago = 0` → 'vencido' ou 'pendente' conforme data

### 3. Corrigir dados existentes

Executar UPDATE para corrigir registros já incorretos no banco.

## Detalhes Técnicos

Uma migration SQL recriará ambas as funções. A edge function não precisa de alteração — ela apenas chama `bulk_upsert_contas_pagar_v2` e `recalculate_contas_pagar_status`.

