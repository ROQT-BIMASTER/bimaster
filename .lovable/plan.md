
# Adicionar Seletor de Filial em Telas de Criação

## ✅ Implementado

### Migração SQL
- ✅ Colunas `empresa_id` e `empresa_nome` adicionadas em:
  - `corporate_events`
  - `corporate_event_expenses`
  - `trade_financial_entries`
  - `trade_budgets`
  - `department_budgets`
- ✅ Índices criados para performance

### Hooks Atualizados
- ✅ `useCorporateEvents.ts` - `CreateEventInput` inclui empresa
- ✅ `useEventExpenses.ts` - `CreateExpenseInput` inclui empresa, propaga para `financial_payment_queue`
- ✅ `useDepartmentBudgets.ts` - `CreateDepartmentBudgetInput` inclui empresa

### Dialogs com Seletor de Filial
- ✅ `NovoEventoDialog.tsx` - Criar evento
- ✅ `NovaDespesaEventoDialog.tsx` - Criar despesa de evento
- ✅ `NovoLancamentoDialog.tsx` - Criar lançamento Trade
- ✅ `SolicitarOrcamentoDialog.tsx` - Solicitar orçamento Trade
- ✅ `SolicitarVerbaDepartamentoDialog.tsx` - Solicitar verba departamento

## Padrão Utilizado

Cada dialog utiliza:
```typescript
import { useUserEmpresas, usePrimaryEmpresa } from "@/hooks/useUserEmpresas";
import { Building } from "lucide-react";

const { data: userEmpresas = [] } = useUserEmpresas();
const { primaryEmpresa } = usePrimaryEmpresa();

// Pre-seleção automática da filial principal
useEffect(() => {
  if (primaryEmpresa && !formData.empresa_id) {
    setFormData(prev => ({ 
      ...prev, 
      empresa_id: primaryEmpresa.id.toString() 
    }));
  }
}, [primaryEmpresa]);
```

## Pendente (Futura Implementação)

| Arquivo | Função |
|---------|--------|
| `SolicitarVerbaEventoDialog.tsx` | Solicitar verba para evento |
| `EditarLancamentoDialog.tsx` | Editar lançamento |
| `EditarInvestimentoDialog.tsx` | Editar investimento |
| `NovaVisitaDialog.tsx` | Criar visita Trade |
| `NovoSellOutDialog.tsx` | Registrar sell-out |
| `NovaPromocaoDialog.tsx` | Criar promoção |
