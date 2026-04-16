

# Diagnóstico: Títulos da Central de Pagamentos vs API Contas a Pagar

## Resultado: NÃO passam pela API

Os títulos gerados na tela "Solicitações de Pagamento" (`FinancialPaymentCentral`) — como o TRD-1773074123049 da screenshot — **não utilizam a API de Contas a Pagar**. Eles fazem INSERT direto no Supabase.

## Fluxo Atual (problemático)

```text
Trade Marketing → financial_payment_queue (fila)
                         ↓ Aceitar
              supabase.from('contas_pagar').insert(...)  ← DIRETO
                         ↓
              financial_payment_queue.update({ contas_pagar_id })
                         ↓
              exportPaymentToErp() (provisão ERP)
```

**Linha 521-525 de `useFinancialPaymentQueue.ts`**: ao aceitar um pagamento, o hook faz `supabase.from('contas_pagar').insert(contaPagarData)` — bypass total da API.

## Riscos

1. **Sem idempotência** — retry duplica o título no `contas_pagar`
2. **Sem transação atômica** — o INSERT no `contas_pagar` pode funcionar mas o UPDATE no `financial_payment_queue` falhar, gerando registro órfão
3. **Sem validação Zod** — campos não validados antes do INSERT
4. **Sem audit trail via API** — `meta.request_id` não gerado
5. **Sem envelope padronizado** — erro retorna formato bruto do Supabase

## Correção Proposta

Substituir o INSERT direto por chamada à API profissionalizada:

### `src/hooks/useFinancialPaymentQueue.ts`

Refatorar o mutation `acceptPayment` (linhas 470-580):

- **Antes**: `supabase.from('contas_pagar').insert(contaPagarData)`
- **Depois**: `callApi("contas-pagar-api", { path: "/incluir", ...contaPagarData })`

Isso garante:
- Idempotência automática via `X-Idempotency-Key` (já implementado no `callApi`)
- Validação Zod server-side
- Audit trail com `request_id`
- Transação atômica se o endpoint usar RPC

### Arquivo afetado

| Arquivo | Alteração |
|---|---|
| `src/hooks/useFinancialPaymentQueue.ts` | Substituir INSERT direto por `callApi("contas-pagar-api", { path: "/incluir" })` no mutation de aceite |

