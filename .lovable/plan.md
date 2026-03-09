

## Problema

Ao reenviar uma despesa rejeitada ("Corrigir e Reenviar"), os três módulos (Eventos, Departamentos e Trade) **sempre fazem `INSERT`** na tabela `financial_payment_queue`, criando um registro duplicado. O `payment_queue_id` no registro de origem é sobrescrito pelo novo ID, mas o registro antigo permanece na fila financeira e nos dashboards.

## Solução

Alterar a lógica de reenvio para que, quando já exista um `payment_queue_id` (modo correção), o sistema faça **`UPDATE`** no registro existente da fila financeira ao invés de criar um novo. Adicionalmente, criar uma tabela de histórico de alterações para rastreabilidade.

## Plano Técnico

### 1. Criar tabela de histórico de correções (migração)

```sql
CREATE TABLE financial_payment_queue_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_queue_id uuid REFERENCES financial_payment_queue(id) ON DELETE CASCADE NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  changed_by_name text,
  changed_at timestamptz DEFAULT now(),
  action text NOT NULL, -- 'submitted', 'rejected', 'corrected', 'approved', 'paid'
  snapshot jsonb NOT NULL, -- snapshot completo dos campos no momento da ação
  changes jsonb -- diff dos campos alterados (old/new)
);

ALTER TABLE financial_payment_queue_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view history" ON financial_payment_queue_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert history" ON financial_payment_queue_history FOR INSERT TO authenticated WITH CHECK (true);
```

### 2. Alterar hooks de Eventos e Departamentos (`useEventExpenses.ts`, `useDepartmentExpenses.ts`)

Na mutation `sendToFinancial`:
- Verificar se o registro de origem já possui `payment_queue_id`
- Se **sim** (correção): fazer `UPDATE` no registro existente da `financial_payment_queue` (atualizar campos editáveis, resetar `financial_status` para `pending`) e salvar snapshot no histórico
- Se **não** (primeiro envio): manter o `INSERT` atual e salvar snapshot inicial no histórico

### 3. Alterar dialog de Trade (`EnviarFinanceiroTradeDialog.tsx`)

Mesma lógica: verificar se `entry.payment_queue_id` já existe:
- Se sim: `UPDATE` no registro existente + histórico
- Se não: `INSERT` novo + histórico

### 4. Componente de timeline de histórico

Criar `PaymentQueueHistory.tsx` — componente que exibe a timeline de alterações de um registro, mostrando quem alterou, quando e quais campos mudaram. Será exibido nos dialogs de revisão financeira e nos banners de rejeição.

### Arquivos a criar/editar

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar tabela `financial_payment_queue_history` |
| `src/hooks/useEventExpenses.ts` | Lógica upsert na mutation `sendToFinancial` |
| `src/hooks/useDepartmentExpenses.ts` | Lógica upsert na mutation `sendToFinancial` |
| `src/components/trade/EnviarFinanceiroTradeDialog.tsx` | Lógica upsert no `handleSubmit` |
| `src/components/shared/PaymentQueueHistory.tsx` | Novo componente de timeline |
| `src/hooks/usePaymentQueueHistory.ts` | Hook para buscar/inserir histórico |

