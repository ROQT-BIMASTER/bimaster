

## Plano: Fluxo Profissional de Contas a Pagar com Exportação ERP em Dois Estágios

### Padrão de Mercado (SAP, TOTVS, Sankhya, Oracle AP)

Sistemas profissionais de contas a pagar operam com o conceito de **provisão contábil** e **baixa financeira**:

```text
Lançamento → Aprovação → Provisão no ERP (Aguardando Pgto) → Pagamento → Baixa no ERP (Pago)
```

O título é registrado no ERP **no momento da aprovação** (provisão), e a baixa ocorre **no momento do pagamento**. Isso garante visibilidade do fluxo de caixa futuro antes da saída efetiva do dinheiro.

### Alterações

**1. Migration — Adicionar `export_type` à `erp_export_queue`**

Coluna para distinguir cadastro (provisão) de baixa (pagamento):
```sql
ALTER TABLE public.erp_export_queue 
  ADD COLUMN export_type text NOT NULL DEFAULT 'payment';
-- Valores: 'registration' (provisão ao aceitar) | 'payment' (baixa ao pagar)
```
Também adicionar `'pull_api'` ao check constraint de `export_channel` e `'exported'` ao check de `export_status` (a Pull API já usa esses valores).

**2. Edge Function `erp-export-payment` — Payload dinâmico por tipo**

- Aceitar novo parâmetro `export_type` (`'registration'` ou `'payment'`)
- Quando `registration`: payload com status `"Aguardando Pagamento"`, sem dados de pagamento
- Quando `payment`: payload completo com método, data de pagamento, status `"Pago"`
- Gravar `export_type` na `erp_export_queue`

**3. Hook `useErpExport.ts` — Suportar tipo de exportação**

Adicionar parâmetro `exportType` à função `exportPaymentToErp`:
```ts
export async function exportPaymentToErp(
  paymentQueueId: string, 
  channel?: string, 
  exportType?: 'registration' | 'payment'
)
```

**4. Hook `useFinancialPaymentQueue.ts` — Trigger automático ao aceitar**

No `acceptPaymentMutation.onSuccess`, chamar:
```ts
exportPaymentToErp(data.id, undefined, 'registration')
```

E no `updateStatusMutation.onSuccess` (quando `paid`), ajustar para:
```ts
exportPaymentToErp(data.id, undefined, 'payment')
```

**5. Edge Function `contas-pagar-export-api` (Pull API) — Expor aceitos**

- Novo parâmetro `?status=accepted,paid` no endpoint `GET /paid`
- Itens aceitos retornam com `"status": "Aguardando Pagamento"`
- Itens pagos retornam com `"status": "Pago"`
- Endpoint `GET /status` inclui contagem de aceitos pendentes de exportação

**6. Atualizar documentação da API**

Refletir os dois tipos de exportação nos exemplos e descrições.

### Fluxo Final

```text
Usuário lança  →  Financeiro aceita  →  ERP recebe: "Aguardando Pagamento" (provisão)
                                              ↓
                  Financeiro paga     →  ERP recebe: "Pago" (baixa do título)
```

### Arquivos Modificados
- Migration SQL (nova coluna + ajuste constraints)
- `supabase/functions/erp-export-payment/index.ts`
- `supabase/functions/contas-pagar-export-api/index.ts`
- `src/hooks/useErpExport.ts`
- `src/hooks/useFinancialPaymentQueue.ts`

