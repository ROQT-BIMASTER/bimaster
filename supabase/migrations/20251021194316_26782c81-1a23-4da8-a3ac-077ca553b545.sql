-- Atualizar verbas retroativamente com lançamentos já aprovados
-- Este script soma os valores dos lançamentos aprovados que estavam vinculados a cada verba

-- Primeiro, resetar spent_amount para recalcular do zero
UPDATE trade_budgets
SET spent_amount = 0;

-- Recalcular spent_amount baseado em lançamentos aprovados
UPDATE trade_budgets b
SET spent_amount = COALESCE(
  (
    SELECT SUM(amount)
    FROM trade_financial_entries e
    WHERE e.budget_id = b.id
      AND e.approval_status = 'approved'
      AND e.status = 'approved'
  ), 0
),
updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM trade_financial_entries e
  WHERE e.budget_id = b.id
    AND e.approval_status = 'approved'
    AND e.status = 'approved'
);