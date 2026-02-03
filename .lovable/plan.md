
# Plano: Corrigir Atualização do Valor Utilizado nas Verbas

## Problema Identificado
O campo "Utilizado" no card de Verbas Disponíveis está mostrando R$ 0 porque:

1. O campo `spent_amount` na tabela `trade_budgets` não está sendo atualizado quando despesas são aprovadas
2. As campanhas não estão sendo vinculadas corretamente às verbas (budget_id está null)
3. A função `updateExpenseStatus` não atualiza o saldo consumido da verba

## Solução

### 1. Atualizar Mutação de Aprovação de Despesas
**Arquivo**: `src/components/trade/campaigns/CampaignExpenses.tsx`

Modificar a função `updateExpenseStatus` para:
- Buscar o `budget_id` da campanha pai quando aprovar uma despesa
- Chamar a função `consume_budget_credit()` do banco para atualizar o `spent_amount` da verba

### 2. Atualizar Aprovação de Campanhas
**Arquivo**: `src/components/trade/campaigns/CampaignValidation.tsx`

Modificar a mutação `approveCampaign` e `approveAllPending` para:
- Buscar todas as despesas aprovadas da campanha
- Verificar se a campanha tem `budget_id` vinculado
- Consumir o crédito da verba com o valor total das despesas aprovadas

### 3. Alternativa: Recalcular em Tempo Real
Como uma solução mais robusta, modificar o hook `useTradeFinanceiroDashboard.ts` para calcular o `totalUtilizado` somando diretamente as despesas aprovadas vinculadas às campanhas que possuem `budget_id`, ao invés de depender apenas do campo `spent_amount`.

---

## Detalhes Técnicos

### Lógica de Consumo de Verba (abordagem proposta)
```typescript
// Em CampaignExpenses.tsx - updateExpenseStatus mutation
const updateExpenseStatus = useMutation({
  mutationFn: async ({ expenseId, status }: { expenseId: string; status: string }) => {
    // ... código existente ...
    
    // Se aprovando, consumir crédito da verba
    if (status === 'aprovado') {
      // Buscar despesa e campanha para obter budget_id
      const { data: expense } = await supabase
        .from("trade_campaign_expenses")
        .select("valor_realizado, campaign:trade_campaigns(budget_id)")
        .eq("id", expenseId)
        .single();
      
      if (expense?.campaign?.budget_id && expense.valor_realizado > 0) {
        await supabase.rpc("consume_budget_credit", {
          p_budget_id: expense.campaign.budget_id,
          p_amount: expense.valor_realizado
        });
      }
    }
  },
});
```

### Cálculo Alternativo no Dashboard
```typescript
// Em useTradeFinanceiroDashboard.ts
// Calcular utilizado baseado nas despesas aprovadas (mais robusto)
const totalUtilizado = despesasQuery.data?.filter((d: any) => 
  ['approved', 'aprovado', 'completed', 'pago'].includes(d.status?.toLowerCase())
).reduce((sum: number, d: any) => sum + (parseFloat(String(d.valor_realizado)) || 0), 0) || 0;
```

### Correção de Dados Existentes (SQL)
Uma migração para recalcular os valores já existentes:
```sql
-- Recalcular spent_amount baseado nas despesas aprovadas
UPDATE trade_budgets b
SET spent_amount = COALESCE(
  (
    SELECT SUM(e.valor_realizado)
    FROM trade_campaign_expenses e
    JOIN trade_campaigns c ON e.campaign_id = c.id
    WHERE c.budget_id = b.id
    AND e.status IN ('aprovado', 'pago')
  ), 0
);
```

## Resultado Esperado
- O card "Verbas Disponíveis" exibirá corretamente o valor utilizado
- A barra de progresso de utilização funcionará corretamente
- O saldo disponível será calculado de forma precisa
