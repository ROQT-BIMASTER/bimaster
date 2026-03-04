

## Plano: Padronizar fluxos de despesas entre Trade, Eventos e Departamentos

### Inconsistências encontradas

Comparando os 3 módulos (Trade, Eventos, Departamentos), há diferenças significativas na forma como cada um envia dados ao financeiro:

| Funcionalidade | Trade | Eventos | Departamentos |
|---|---|---|---|
| Sugestões IA (FinancialFieldsSuggestion) | ✅ | ✅ | ❌ Faltando |
| Portador como Select (com portadores do banco) | ❌ Input texto livre | ✅ | ✅ |
| Validação de anexos obrigatórios | ✅ | ❌ Não valida | ✅ |
| Validação de status aprovado | ✅ | ❌ Não valida | ❌ Não valida |
| Banner de política de corte financeiro | ✅ | ❌ Faltando | ❌ Faltando |
| `payment_queue_id` salvo na tabela de origem | ✅ | ❌ Não salva | ❌ Não salva |
| Boleto/parcela incluído nas `notes` da queue | ✅ (formatado) | ✅ (básico) | ✅ (básico) |
| Hook faz insert direto vs dialog faz insert | Dialog faz insert | Hook faz insert | Hook faz insert |

### Correções a implementar

#### 1. EnviarFinanceiroDepDialog — adicionar features faltantes
- Adicionar `FinancialFieldsSuggestion` (sugestões IA)
- Adicionar banner de política de corte financeiro (`useActivePaymentPolicy`)
- Adicionar validação de status aprovado antes do envio

#### 2. EnviarFinanceiroDialog (Eventos) — adicionar features faltantes
- Adicionar banner de política de corte financeiro (`useActivePaymentPolicy`)
- Adicionar validação de anexos obrigatórios (bloquear envio sem anexos)
- Adicionar validação de status aprovado

#### 3. Trade — corrigir Portador para usar Select com portadores do banco
- Substituir o `Input` texto livre por `Select` com `usePortadores()`, igual aos outros módulos

#### 4. Hooks (Eventos e Departamentos) — salvar `payment_queue_id`
- Após inserir na `financial_payment_queue`, pegar o `id` retornado e salvar na tabela de origem (`corporate_event_expenses.payment_queue_id` / `department_expenses.payment_queue_id`), igual ao Trade faz
- Verificar se as colunas `payment_queue_id` existem nessas tabelas; se não, criar via migração

#### 5. Padronizar formato das `notes` na queue
- Usar o mesmo formato do Trade em todos: `"Observações | Linha digitável: XXX | Parcela X/Y"` separado por `" | "`

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/components/departments/EnviarFinanceiroDepDialog.tsx` | +IA suggestions, +policy banner, +validação aprovação |
| `src/components/events/EnviarFinanceiroDialog.tsx` | +policy banner, +validação anexos/aprovação |
| `src/components/trade/EnviarFinanceiroTradeDialog.tsx` | Portador: Input → Select com usePortadores |
| `src/hooks/useEventExpenses.ts` | Salvar `payment_queue_id` após insert na queue |
| `src/hooks/useDepartmentExpenses.ts` | Salvar `payment_queue_id` após insert na queue |
| Migração SQL (se necessário) | Adicionar `payment_queue_id` em `corporate_event_expenses` e `department_expenses` |

