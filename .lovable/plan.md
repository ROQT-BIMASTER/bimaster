

# Plano: 3 Ajustes para Arquitetura Bilateral Completa

## Contexto Crítico Descoberto

A coluna `status` em `contas_pagar` é calculada por um **trigger** (`calcular_status_conta_pagar`) que sobrescreve o valor em todo INSERT/UPDATE. O trigger só conhece: `pago`, `parcial`, `vencido`, `pendente`. Isso significa:

- **Cancelado** nunca será preservado se não atualizarmos o trigger
- **Baixa via ERP** precisa zerar `valor_aberto` para que o trigger calcule `pago` (ou o trigger precisa respeitar overrides)

A export API (`contas-pagar-export-api`) consulta `financial_payment_queue`, não `contas_pagar`. Para títulos cancelados, precisamos adicionar uma rota que consulte `contas_pagar` diretamente.

---

## AJUSTE 1 — Migration

```sql
-- Novas colunas
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS pluggy_transaction_id TEXT;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS baixa_origem TEXT;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS data_baixa TIMESTAMPTZ;

-- Atualizar trigger para suportar 'cancelado' (preservar se explicitamente definido)
CREATE OR REPLACE FUNCTION calcular_status_conta_pagar()
RETURNS TRIGGER AS $$
BEGIN
  -- Preservar status 'cancelado' se definido explicitamente
  IF NEW.status = 'cancelado' THEN
    RETURN NEW;
  END IF;
  NEW.status := CASE 
    WHEN NEW.valor_aberto = 0 OR NEW.valor_aberto IS NULL THEN 'pago'
    WHEN NEW.valor_pago > 0 AND NEW.valor_aberto > 0 THEN 'parcial'
    WHEN NEW.data_vencimento < CURRENT_DATE AND NEW.valor_aberto > 0 THEN 'vencido'
    ELSE 'pendente'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Nota: Não usamos CHECK constraint em `baixa_origem` — usamos validação no código para evitar problemas com restauração de backups.

## AJUSTE 2 — Edge Function `erp-webhook-inbound`

Adicionar bloco após a atualização da fila (linha ~102) e antes do log (linha ~104):

Quando `payload.evento === 'baixa_confirmada'` e `contaPagarId` existe:
1. Buscar a conta atual (`status`)
2. Se status ≠ `pago` → atualizar:
   - `valor_pago = payload.valor_processado || valor_original`
   - `valor_aberto = 0` (para que o trigger calcule `pago`)
   - `baixa_origem = 'erp_webhook'`
   - `data_baixa = payload.data_processamento`
   - `data_pagamento = payload.data_processamento`
3. Se já `pago` → ignorar (Pluggy ou outra fonte já processou), registrar no log com flag `conta_ja_paga: true`

## AJUSTE 3 — Edge Function `contas-pagar-export-api`

Adicionar suporte a `?status=cancelado` no `handleGetItems`:

Quando `statuses` contém `cancelado`:
1. Consultar `contas_pagar` (não `financial_payment_queue`) filtrando `status = 'cancelado'`
2. Verificar na `erp_export_queue` quais já foram exportados como `cancellation`
3. Retornar payload limpo com os dados do título cancelado (fornecedor, documento, valor, data_cancelamento)
4. O endpoint POST `/confirm` com `export_type = 'cancellation'` já funcionará para marcar como exportado

### Arquivos modificados
- **1 migration SQL** (3 colunas + trigger atualizado)
- `supabase/functions/erp-webhook-inbound/index.ts` (bloco de baixa automática)
- `supabase/functions/contas-pagar-export-api/index.ts` (rota cancelado)

